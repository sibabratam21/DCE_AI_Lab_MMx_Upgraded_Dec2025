/**
 * Dataset version guard utilities for ensuring data integrity across the app
 */

import { ParsedData } from '../types';

export interface DatasetInfo {
  dataset_hash: string;
  row_count: number;
  last_updated: string;
  column_count: number;
  first_rows_hash: string;
  last_rows_hash: string;
}

export interface DatasetProvenance {
  dataset_hash: string;
  features_hash?: string;
  ranges_hash?: string;
  timestamp: number;
}

/**
 * Compute SHA-256 hash of a string
 */
async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonicalize CSV data for consistent hashing
 */
function canonicalizeCSVData(data: ParsedData[]): string {
  if (data.length === 0) return '';

  // Get consistent column order (alphabetically sorted)
  const headers = Object.keys(data[0]).sort();
  
  // Create canonical CSV representation
  const headerRow = headers.join(',');
  
  // Get first and last 5 rows for sampling (or all rows if fewer than 10)
  const sampleRows: ParsedData[] = [];
  const sampleSize = 5;
  
  // Add first 5 rows
  for (let i = 0; i < Math.min(sampleSize, data.length); i++) {
    sampleRows.push(data[i]);
  }
  
  // Add last 5 rows (avoid duplicates if dataset is small)
  const startIdx = Math.max(sampleSize, data.length - sampleSize);
  for (let i = startIdx; i < data.length; i++) {
    if (!sampleRows.includes(data[i])) {
      sampleRows.push(data[i]);
    }
  }
  
  // Convert sample rows to canonical format
  const canonicalRows = sampleRows.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (typeof value === 'number') {
        // Normalize numbers to avoid floating point precision issues
        return Number(value.toPrecision(10));
      }
      return value || '';
    }).join(',');
  });
  
  return [headerRow, ...canonicalRows].join('\n');
}

/**
 * Generate dataset hash from parsed data
 */
export async function generateDatasetHash(data: ParsedData[]): Promise<DatasetInfo> {
  if (data.length === 0) {
    throw new Error('Cannot generate hash for empty dataset');
  }

  // Create canonical representation
  const canonicalData = canonicalizeCSVData(data);
  
  // Include metadata for more robust hashing
  const headers = Object.keys(data[0]).sort();
  const metadata = {
    row_count: data.length,
    column_count: headers.length,
    headers: headers,
    canonical_sample: canonicalData
  };
  
  const metadataString = JSON.stringify(metadata);
  const dataset_hash = await computeSHA256(metadataString);
  
  // Generate hashes for first and last rows for additional integrity
  const firstRowsData = data.slice(0, 5).map(row => 
    headers.map(h => row[h]).join(',')
  ).join('\n');
  const lastRowsData = data.slice(-5).map(row => 
    headers.map(h => row[h]).join(',')
  ).join('\n');
  
  const first_rows_hash = await computeSHA256(firstRowsData);
  const last_rows_hash = await computeSHA256(lastRowsData);

  return {
    dataset_hash,
    row_count: data.length,
    last_updated: new Date().toISOString(),
    column_count: headers.length,
    first_rows_hash,
    last_rows_hash
  };
}

/**
 * Generate features hash from feature parameters
 */
export async function generateFeaturesHash(selectedChannels: string[], params?: any): Promise<string> {
  const featuresData = {
    selected_channels: selectedChannels.sort(),
    params: params || null
  };
  
  return computeSHA256(JSON.stringify(featuresData));
}

/**
 * Generate parameter ranges hash
 */
export async function generateRangesHash(ranges: any): Promise<string> {
  return computeSHA256(JSON.stringify(ranges));
}

/**
 * Create provenance object
 */
export function createProvenance(
  dataset_hash: string, 
  features_hash?: string, 
  ranges_hash?: string
): DatasetProvenance {
  return {
    dataset_hash,
    features_hash,
    ranges_hash,
    timestamp: Date.now()
  };
}

/**
 * Validate provenance against current dataset
 */
export function validateProvenance(
  responseProvenance: DatasetProvenance | undefined,
  currentDatasetHash: string
): { isValid: boolean; reason?: string } {
  if (!responseProvenance) {
    return { isValid: false, reason: 'Missing provenance data' };
  }
  
  if (responseProvenance.dataset_hash !== currentDatasetHash) {
    return { 
      isValid: false, 
      reason: `Dataset changed. Expected: ${currentDatasetHash.slice(0, 8)}, Got: ${responseProvenance.dataset_hash.slice(0, 8)}` 
    };
  }
  
  return { isValid: true };
}

/**
 * Format dataset hash for display (short version)
 */
export function formatHashForDisplay(hash: string): string {
  return hash.slice(0, 7);
}

/**
 * Check if two hashes match
 */
export function hashesMatch(hash1: string | undefined, hash2: string | undefined): boolean {
  return hash1 === hash2 && !!hash1;
}