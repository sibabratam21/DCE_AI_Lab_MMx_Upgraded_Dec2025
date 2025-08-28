/**
 * Simplified report view selectors for strict model consistency (without operating points)
 */

import { ModelRun } from '../types';
import { eqSet, ModelById, ContributionsById, DiagnosticsById } from './modelSelectors';
import { getConsistentChannelSpend } from './demoSimulation';

export interface ReportMetrics {
  modelId: string;
  totalSpend: number;
  totalImpact: number;
  baseImpact: number;
  marketingImpact: number;
  blendedROI: number;
}

export interface MetricsById {
  [id: string]: ReportMetrics;
}

export interface ReportView {
  model: ModelRun | null;
  metrics: ReportMetrics | null;
  attribution: ContributionsById[string] | null;
  diagnostics: DiagnosticsById[string] | null;
  consistent: boolean;
  inconsistencyReason?: string;
}

/**
 * Create simplified report data stores from models (without complex curves)
 */
export const createReportDataStores = (models: ModelRun[]): {
  modelById: ModelById;
  contributionsById: ContributionsById;
  diagnosticsById: DiagnosticsById;
  metricsById: MetricsById;
} => {
  const modelById: ModelById = {};
  const contributionsById: ContributionsById = {};
  const diagnosticsById: DiagnosticsById = {};
  const metricsById: MetricsById = {};

  models.forEach(model => {
    // Store model
    modelById[model.id] = model;

    // Extract channels
    const channels = model.channels || model.details.map(d => d.name);
    const includedChannels = model.details.filter(d => d.included);

    // Create contributions data
    contributionsById[model.id] = {
      modelId: model.id,
      channels,
      contributions: model.details.map(detail => ({
        channel: detail.name,
        value: detail.contribution,
        percentage: detail.contribution
      }))
    };

    // Create diagnostics data
    diagnosticsById[model.id] = {
      modelId: model.id,
      channels,
      diagnostics: model.details.map(detail => ({
        channel: detail.name,
        pValue: detail.pValue,
        coefficient: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.coefficient,
        stderr: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.stderr,
        confidence_interval: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.confidence_interval,
        sign: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.actual_sign,
        importance: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.importance
      }))
    };

    // Calculate metrics using original approach
    const totalSpend = includedChannels.reduce((sum, p) => {
      return sum + getConsistentChannelSpend(p.name) / 1000000; // Convert to M
    }, 0);
    
    const totalImpact = 100000; // Total KPI impact
    const basePercentage = 25; // Base sales represent 25%
    const baseImpact = (basePercentage / 100) * totalImpact;
    const marketingImpact = totalImpact - baseImpact;

    metricsById[model.id] = {
      modelId: model.id,
      totalSpend,
      totalImpact,
      baseImpact,
      marketingImpact,
      blendedROI: model.roi
    };
  });

  return { modelById, contributionsById, diagnosticsById, metricsById };
};

/**
 * Selector for report view with strict model consistency
 * Contract: activeModel.channels === selectedChannels (strict equality)
 */
export const selectReportView = (
  activeModelId: string | null,
  selectedChannels: string[],
  modelById: ModelById,
  contributionsById: ContributionsById,
  diagnosticsById: DiagnosticsById,
  metricsById: MetricsById
): ReportView => {
  // No active model selected
  if (!activeModelId) {
    return {
      model: null,
      metrics: null,
      attribution: null,
      diagnostics: null,
      consistent: false,
      inconsistencyReason: 'No model selected'
    };
  }

  // Get all data sources
  const model = modelById[activeModelId] || null;
  const metrics = metricsById[activeModelId] || null;
  const attribution = contributionsById[activeModelId] || null;
  const diagnostics = diagnosticsById[activeModelId] || null;

  // Check if all data exists
  if (!model || !metrics || !attribution || !diagnostics) {
    const missing = [];
    if (!model) missing.push('model');
    if (!metrics) missing.push('metrics');
    if (!attribution) missing.push('attribution');
    if (!diagnostics) missing.push('diagnostics');
    
    return {
      model,
      metrics,
      attribution,
      diagnostics,
      consistent: false,
      inconsistencyReason: `Missing data: ${missing.join(', ')}`
    };
  }

  // STRICT channel equality check: set(activeModel.channels) === set(selectedChannels)
  const modelChannels = new Set(model.channels || []);
  const selectedChannelsSet = new Set(selectedChannels);

  const channelsMatch = eqSet(modelChannels, selectedChannelsSet);

  if (!channelsMatch) {
    const reason = `Channel mismatch - Model: [${Array.from(modelChannels).join(', ')}], ` +
                   `Selected: [${Array.from(selectedChannelsSet).join(', ')}]`;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ReportSelector] ${reason}`);
    }
    
    return {
      model,
      metrics,
      attribution,
      diagnostics,
      consistent: false,
      inconsistencyReason: reason
    };
  }

  // Additional consistency checks across data blocks
  const allChannelsMatch = 
    eqSet(modelChannels, new Set(attribution.channels)) &&
    eqSet(modelChannels, new Set(diagnostics.channels));

  if (!allChannelsMatch) {
    return {
      model,
      metrics,
      attribution,
      diagnostics,
      consistent: false,
      inconsistencyReason: 'Data consistency error: channel arrays do not match across blocks'
    };
  }

  // All checks passed - data is consistent
  return {
    model,
    metrics,
    attribution,
    diagnostics,
    consistent: true
  };
};