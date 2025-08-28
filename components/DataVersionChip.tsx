/**
 * Data Version Chip - Shows dataset integrity status in navigation
 */

import React from 'react';
import { getDatasetDisplayInfo, getCurrentDataset } from '../services/datasetStore';
import { hasStaleData } from '../services/tabGateSelectors';
import type { DatasetProvenance } from '../utils/datasetHash';

interface DataVersionChipProps {
  stepData?: {
    validation?: { provenance?: DatasetProvenance };
    features?: { provenance?: DatasetProvenance };
    model?: { provenance?: DatasetProvenance };
    report?: { provenance?: DatasetProvenance };
    optimize?: { provenance?: DatasetProvenance };
  };
  onClick?: () => void;
}

export const DataVersionChip: React.FC<DataVersionChipProps> = ({ 
  stepData, 
  onClick 
}) => {
  const datasetInfo = getDatasetDisplayInfo();
  const isStale = hasStaleData(stepData);
  
  // Don't show chip if no dataset loaded
  if (!datasetInfo.shortHash) {
    return null;
  }
  
  const getChipColor = () => {
    if (isStale) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };
  
  const getIcon = () => {
    if (isStale) {
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  };
  
  const getTooltipText = () => {
    if (isStale) {
      return `Dataset ${datasetInfo.shortHash} - Data may be stale, consider refreshing`;
    }
    return `Dataset ${datasetInfo.shortHash} - ${datasetInfo.rowCount} rows - Data integrity verified`;
  };
  
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80 ${getChipColor()}`}
        title={getTooltipText()}
      >
        {getIcon()}
        <span className="font-mono">{datasetInfo.shortHash}</span>
        {datasetInfo.rowCount && (
          <span className="text-xs opacity-75">({datasetInfo.rowCount})</span>
        )}
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {getTooltipText()}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
      </div>
    </div>
  );
};

/**
 * Compact version for mobile/small spaces
 */
export const CompactDataVersionChip: React.FC<DataVersionChipProps> = ({ 
  stepData, 
  onClick 
}) => {
  const datasetInfo = getDatasetDisplayInfo();
  const isStale = hasStaleData(stepData);
  
  if (!datasetInfo.shortHash) {
    return null;
  }
  
  const getStatusColor = () => {
    if (isStale) return 'text-amber-500';
    return 'text-green-500';
  };
  
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-xs ${getStatusColor()} hover:opacity-70 transition-opacity`}
      title={`Dataset ${datasetInfo.shortHash} ${isStale ? '(stale)' : '(fresh)'}`}
    >
      <div className={`w-2 h-2 rounded-full ${isStale ? 'bg-amber-500' : 'bg-green-500'}`} />
      <span className="font-mono">{datasetInfo.shortHash}</span>
    </button>
  );
};

/**
 * Development version with detailed info
 */
export const DevDataVersionChip: React.FC<DataVersionChipProps> = ({ 
  stepData, 
  onClick 
}) => {
  const datasetInfo = getDatasetDisplayInfo();
  const datasetState = getCurrentDataset();
  const isStale = hasStaleData(stepData);
  
  if (!datasetInfo.shortHash) {
    return (
      <div className="text-xs text-red-500 font-mono">
        NO DATASET
      </div>
    );
  }
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 text-xs font-mono space-y-1">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-amber-500' : 'bg-green-500'}`} />
        <span className="font-bold">Dataset: {datasetInfo.shortHash}</span>
      </div>
      
      <div className="text-gray-600">
        <div>Rows: {datasetInfo.rowCount}</div>
        {datasetState.lastValidationTime && (
          <div>Last Check: {formatTimestamp(datasetState.lastValidationTime)}</div>
        )}
        {datasetState.currentProvenance && (
          <div>Created: {formatTimestamp(datasetState.currentProvenance.timestamp)}</div>
        )}
      </div>
      
      {onClick && (
        <button
          onClick={onClick}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          View Details
        </button>
      )}
    </div>
  );
};