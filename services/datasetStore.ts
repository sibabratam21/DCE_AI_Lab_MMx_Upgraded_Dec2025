/**
 * Dataset Store - Centralized dataset and provenance tracking
 */

import { ParsedData } from '../types';
import { 
  DatasetInfo, 
  DatasetProvenance, 
  generateDatasetHash, 
  generateFeaturesHash, 
  generateRangesHash, 
  createProvenance, 
  validateProvenance,
  formatHashForDisplay 
} from '../utils/datasetHash';

export interface DatasetStore {
  currentData: ParsedData[] | null;
  datasetInfo: DatasetInfo | null;
  currentProvenance: DatasetProvenance | null;
  lastValidationTime: number | null;
}

// Global dataset store state
let datasetStore: DatasetStore = {
  currentData: null,
  datasetInfo: null,
  currentProvenance: null,
  lastValidationTime: null
};

// Store update listeners for reactive updates
const listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener());
}

/**
 * Subscribe to dataset store changes
 */
export function subscribeToDataset(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Set current dataset and generate hash info
 */
export async function setCurrentDataset(data: ParsedData[]): Promise<DatasetInfo> {
  try {
    const datasetInfo = await generateDatasetHash(data);
    
    datasetStore = {
      currentData: data,
      datasetInfo,
      currentProvenance: createProvenance(datasetInfo.dataset_hash),
      lastValidationTime: Date.now()
    };
    
    notifyListeners();
    return datasetInfo;
  } catch (error) {
    console.error('Failed to set current dataset:', error);
    throw error;
  }
}

/**
 * Get current dataset store state
 */
export function getCurrentDataset(): DatasetStore {
  return { ...datasetStore };
}

/**
 * Get current dataset hash
 */
export function getCurrentDatasetHash(): string | null {
  return datasetStore.datasetInfo?.dataset_hash || null;
}

/**
 * Check if dataset is loaded
 */
export function isDatasetLoaded(): boolean {
  return !!(datasetStore.currentData && datasetStore.datasetInfo);
}

/**
 * Generate provenance for feature engineering step
 */
export async function generateFeatureProvenance(
  selectedChannels: string[], 
  params?: any
): Promise<DatasetProvenance> {
  const datasetHash = getCurrentDatasetHash();
  if (!datasetHash) {
    throw new Error('No dataset loaded for provenance generation');
  }
  
  const featuresHash = await generateFeaturesHash(selectedChannels, params);
  
  return createProvenance(datasetHash, featuresHash);
}

/**
 * Generate provenance for modeling step
 */
export async function generateModelProvenance(
  selectedChannels: string[], 
  params: any, 
  ranges: any
): Promise<DatasetProvenance> {
  const datasetHash = getCurrentDatasetHash();
  if (!datasetHash) {
    throw new Error('No dataset loaded for provenance generation');
  }
  
  const [featuresHash, rangesHash] = await Promise.all([
    generateFeaturesHash(selectedChannels, params),
    generateRangesHash(ranges)
  ]);
  
  return createProvenance(datasetHash, featuresHash, rangesHash);
}

/**
 * Validate response provenance against current dataset
 */
export function validateResponseProvenance(
  responseProvenance: DatasetProvenance | undefined
): { isValid: boolean; reason?: string; shouldRefresh?: boolean } {
  const currentHash = getCurrentDatasetHash();
  
  if (!currentHash) {
    return { 
      isValid: false, 
      reason: 'No dataset loaded for validation',
      shouldRefresh: true 
    };
  }
  
  const validation = validateProvenance(responseProvenance, currentHash);
  
  return {
    ...validation,
    shouldRefresh: !validation.isValid
  };
}

/**
 * Get dataset info for display
 */
export function getDatasetDisplayInfo(): {
  hash: string | null;
  shortHash: string | null;
  rowCount: number | null;
  lastUpdated: string | null;
} {
  const { datasetInfo } = datasetStore;
  
  return {
    hash: datasetInfo?.dataset_hash || null,
    shortHash: datasetInfo ? formatHashForDisplay(datasetInfo.dataset_hash) : null,
    rowCount: datasetInfo?.row_count || null,
    lastUpdated: datasetInfo?.last_updated || null
  };
}

/**
 * Clear dataset store (for testing or reset)
 */
export function clearDataset(): void {
  datasetStore = {
    currentData: null,
    datasetInfo: null,
    currentProvenance: null,
    lastValidationTime: null
  };
  
  notifyListeners();
}

/**
 * Check if data has changed since last validation
 */
export function isDataStale(thresholdMinutes = 30): boolean {
  if (!datasetStore.lastValidationTime) return true;
  
  const now = Date.now();
  const timeDiff = now - datasetStore.lastValidationTime;
  const minutesDiff = timeDiff / (1000 * 60);
  
  return minutesDiff > thresholdMinutes;
}

/**
 * Refresh validation timestamp
 */
export function refreshValidationTime(): void {
  datasetStore.lastValidationTime = Date.now();
}

/**
 * Export current dataset state for debugging
 */
export function exportDatasetState(): any {
  return {
    hasData: !!datasetStore.currentData,
    rowCount: datasetStore.currentData?.length || 0,
    datasetHash: datasetStore.datasetInfo?.dataset_hash,
    shortHash: datasetStore.datasetInfo ? formatHashForDisplay(datasetStore.datasetInfo.dataset_hash) : null,
    provenanceTimestamp: datasetStore.currentProvenance?.timestamp,
    lastValidation: datasetStore.lastValidationTime,
    isStale: isDataStale()
  };
}