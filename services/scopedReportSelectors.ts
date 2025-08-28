/**
 * Scoped Report Selectors - Handle media spend flows with proper data reconciliation
 */

import { ParsedData, ModelRun } from '../types';
import { getCurrentDataset } from './datasetStore';

export interface ScopedFrame {
  data: ParsedData[];
  period: string;
  scope: string;
  dataset_hash: string;
}

export interface DataTotals {
  totalSpend: number;
  totalKPI: number;
  channelSpends: Record<string, number>;
  channelActivities: Record<string, number>;
  period: string;
}

export interface ScopedReportView {
  model: ModelRun | null;
  dataTotals: DataTotals | null;
  modelContributions: Record<string, number>;
  reconciliation: {
    dataSpend: number;
    modelSpend: number;
    spendMatch: boolean;
    dataKPI: number;
    modelKPI: number;
    kpiMatch: boolean;
  };
  consistent: boolean;
  inconsistencyReason?: string;
}

/**
 * Select scoped frame based on dataset hash and scope
 * National: aggregate by Week, sum over DMAs
 * Single DMA: filter by DMA_ID
 */
export function selectScopedFrame(
  dataset_hash: string, 
  scope: 'ALL' | string = 'ALL'
): ScopedFrame {
  const datasetStore = getCurrentDataset();
  
  if (!datasetStore.currentData || !datasetStore.datasetInfo) {
    throw new Error('No dataset loaded');
  }
  
  if (datasetStore.datasetInfo.dataset_hash !== dataset_hash) {
    throw new Error(`Dataset hash mismatch. Expected: ${dataset_hash}, Current: ${datasetStore.datasetInfo.dataset_hash}`);
  }
  
  let scopedData = datasetStore.currentData;
  
  if (scope === 'ALL') {
    // National scope: Group by Week and sum over DMAs
    const weeklyData = new Map<string, ParsedData>();
    
    scopedData.forEach(row => {
      const week = String(row.Week || row.week);
      if (!week) return;
      
      if (!weeklyData.has(week)) {
        // Initialize with non-aggregatable fields
        weeklyData.set(week, {
          Week: week,
          week: week
        });
      }
      
      const weekRow = weeklyData.get(week)!;
      
      // Aggregate numerical fields (spend, activities, KPIs, competitor)
      Object.keys(row).forEach(key => {
        if (key === 'Week' || key === 'week') return;
        
        const value = Number(row[key]);
        if (!isNaN(value)) {
          weekRow[key] = (Number(weekRow[key]) || 0) + value;
        } else {
          // Keep non-numeric values from first occurrence
          if (!weekRow[key]) {
            weekRow[key] = row[key];
          }
        }
      });
    });
    
    // Convert back to array and sort by week
    scopedData = Array.from(weeklyData.values()).sort((a, b) => {
      const weekA = new Date(String(a.Week || a.week));
      const weekB = new Date(String(b.Week || b.week));
      return weekA.getTime() - weekB.getTime();
    });
    
    // Recompute Lagged_TRx after aggregation
    scopedData.forEach((row, index) => {
      if (index === 0) {
        // First week: use TRx value
        row.Lagged_TRx = row.TRx;
      } else {
        // Use previous week's TRx
        row.Lagged_TRx = scopedData[index - 1].TRx;
      }
    });
    
  } else {
    // Single DMA scope: filter by DMA_ID
    scopedData = scopedData.filter(row => String(row.DMA_ID) === scope);
    // Keep original Lagged_TRx for single DMA
  }
  
  return {
    data: scopedData,
    period: `${scopedData.length} weeks`,
    scope: scope === 'ALL' ? 'National' : `DMA ${scope}`,
    dataset_hash
  };
}

/**
 * Compute totals from actual data (not from model)
 */
export function computeDataTotals(
  scopedFrame: ScopedFrame,
  period: 'ALL' | { start: string; end: string } = 'ALL'
): DataTotals {
  let data = scopedFrame.data;
  
  // Filter by period if specified
  if (period !== 'ALL') {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    
    data = data.filter(row => {
      const rowDate = new Date(String(row.Week || row.week));
      return rowDate >= startDate && rowDate <= endDate;
    });
  }
  
  // Aggregate totals
  let totalKPI = 0;
  let totalSpend = 0;
  const channelSpends: Record<string, number> = {};
  const channelActivities: Record<string, number> = {};
  
  data.forEach(row => {
    // Sum KPI (TRx)
    const kpi = Number(row.TRx || row.trx || 0);
    totalKPI += kpi;
    
    // Sum all spend columns
    Object.keys(row).forEach(key => {
      if (key.includes('_Spend') || key.includes('_spend')) {
        const spend = Number(row[key]) || 0;
        totalSpend += spend;
        
        // Extract channel name (remove _Spend suffix)
        const channelName = key.replace(/_[Ss]pend$/, '');
        channelSpends[channelName] = (channelSpends[channelName] || 0) + spend;
      }
      
      // Sum activity columns (impressions, clicks, etc.)
      if (key.includes('_Impressions') || key.includes('_Clicks') || 
          key.includes('_Events') || key.includes('_Count') || 
          key.includes('_Sends') || key.includes('_Redemptions') ||
          key.includes('_Engagements')) {
        const activity = Number(row[key]) || 0;
        
        // Extract channel name
        const channelName = key.replace(/_[A-Z][a-z]+$/, '');
        channelActivities[channelName] = (channelActivities[channelName] || 0) + activity;
      }
    });
  });
  
  return {
    totalSpend: Math.round(totalSpend),
    totalKPI: Math.round(totalKPI),
    channelSpends,
    channelActivities,
    period: period === 'ALL' ? `All ${data.length} weeks` : `${period.start} to ${period.end}`
  };
}

/**
 * Enhanced report view with data reconciliation
 */
export function selectScopedReportView(
  activeModelId: string | null,
  models: ModelRun[],
  selectedChannels: string[],
  dataset_hash: string,
  scope: 'ALL' | string = 'ALL',
  period: 'ALL' | { start: string; end: string } = 'ALL'
): ScopedReportView {
  
  if (!activeModelId) {
    return {
      model: null,
      dataTotals: null,
      modelContributions: {},
      reconciliation: {
        dataSpend: 0,
        modelSpend: 0,
        spendMatch: false,
        dataKPI: 0,
        modelKPI: 0,
        kpiMatch: false
      },
      consistent: false,
      inconsistencyReason: 'No model selected'
    };
  }
  
  const model = models.find(m => m.id === activeModelId);
  
  if (!model) {
    return {
      model: null,
      dataTotals: null,
      modelContributions: {},
      reconciliation: {
        dataSpend: 0,
        modelSpend: 0,
        spendMatch: false,
        dataKPI: 0,
        modelKPI: 0,
        kpiMatch: false
      },
      consistent: false,
      inconsistencyReason: 'Model not found'
    };
  }
  
  // Check channel consistency
  const modelChannels = new Set(model.channels || model.details.map(d => d.name));
  const selectedChannelsSet = new Set(selectedChannels);
  
  if (!eqSet(modelChannels, selectedChannelsSet)) {
    return {
      model,
      dataTotals: null,
      modelContributions: {},
      reconciliation: {
        dataSpend: 0,
        modelSpend: 0,
        spendMatch: false,
        dataKPI: 0,
        modelKPI: 0,
        kpiMatch: false
      },
      consistent: false,
      inconsistencyReason: `Channel mismatch. Model: [${Array.from(modelChannels).join(', ')}], Selected: [${selectedChannels.join(', ')}]`
    };
  }
  
  try {
    // Get scoped data frame
    const scopedFrame = selectScopedFrame(dataset_hash, scope);
    
    // Compute data totals for the period
    const dataTotals = computeDataTotals(scopedFrame, period);
    
    // Compute model contributions (from model details)
    const modelContributions: Record<string, number> = {};
    let totalModelKPI = 0;
    
    model.details.forEach(detail => {
      if (detail.included) {
        // Model contribution as percentage of total KPI
        const contributionValue = (detail.contribution / 100) * dataTotals.totalKPI;
        modelContributions[detail.name] = contributionValue;
        totalModelKPI += contributionValue;
      }
    });
    
    // Calculate model spend from channel spends (should match data totals)
    let totalModelSpend = 0;
    Object.keys(dataTotals.channelSpends).forEach(channel => {
      if (modelChannels.has(channel)) {
        totalModelSpend += dataTotals.channelSpends[channel];
      }
    });
    
    // Reconciliation check
    const spendTolerance = 0.01; // 1% tolerance
    const kpiTolerance = 0.02; // 2% tolerance
    
    const spendMatch = Math.abs(dataTotals.totalSpend - totalModelSpend) / dataTotals.totalSpend < spendTolerance;
    const kpiMatch = Math.abs(dataTotals.totalKPI - totalModelKPI) / dataTotals.totalKPI < kpiTolerance;
    
    return {
      model,
      dataTotals,
      modelContributions,
      reconciliation: {
        dataSpend: dataTotals.totalSpend,
        modelSpend: totalModelSpend,
        spendMatch,
        dataKPI: dataTotals.totalKPI,
        modelKPI: Math.round(totalModelKPI),
        kpiMatch
      },
      consistent: true
    };
    
  } catch (error) {
    return {
      model,
      dataTotals: null,
      modelContributions: {},
      reconciliation: {
        dataSpend: 0,
        modelSpend: 0,
        spendMatch: false,
        dataKPI: 0,
        modelKPI: 0,
        kpiMatch: false
      },
      consistent: false,
      inconsistencyReason: `Data processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function for set equality (if not already available)
function eqSet<T>(set1: Set<T>, set2: Set<T>): boolean {
  return set1.size === set2.size && [...set1].every(x => set2.has(x));
}