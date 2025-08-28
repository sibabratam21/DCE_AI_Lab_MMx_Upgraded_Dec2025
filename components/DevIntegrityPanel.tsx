/**
 * Development Integrity Panel - Testing and debugging dataset version guards
 */

import React, { useState, useEffect } from 'react';
import { 
  exportDatasetState, 
  getCurrentDataset, 
  clearDataset, 
  isDatasetLoaded,
  validateResponseProvenance 
} from '../services/datasetStore';
import { 
  getAllStepValidations, 
  getStepAccessSummary, 
  clearValidationCache 
} from '../services/tabGateSelectors';
import { AppStep } from '../types';
import type { DatasetProvenance } from '../utils/datasetHash';

interface DevIntegrityPanelProps {
  currentStep: AppStep;
  stepData?: {
    validation?: { provenance?: DatasetProvenance };
    features?: { provenance?: DatasetProvenance };
    model?: { provenance?: DatasetProvenance };
    report?: { provenance?: DatasetProvenance };
    optimize?: { provenance?: DatasetProvenance };
  };
}

export const DevIntegrityPanel: React.FC<DevIntegrityPanelProps> = ({
  currentStep,
  stepData
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [datasetState, setDatasetState] = useState<any>(null);
  const [stepValidations, setStepValidations] = useState<any>(null);
  const [accessSummary, setAccessSummary] = useState<any>(null);
  
  // Auto-refresh data every 2 seconds when panel is open
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      refreshData();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isOpen, currentStep, stepData]);
  
  const refreshData = () => {
    setDatasetState(exportDatasetState());
    setStepValidations(getAllStepValidations(stepData));
    setAccessSummary(getStepAccessSummary(currentStep, stepData));
  };
  
  const handleClearDataset = () => {
    if (confirm('Clear dataset store? This will reset all data.')) {
      clearDataset();
      refreshData();
    }
  };
  
  const handleClearCache = () => {
    clearValidationCache();
    refreshData();
  };
  
  const testProvenanceValidation = (provenance?: DatasetProvenance) => {
    if (!provenance) return 'No provenance provided';
    
    const result = validateResponseProvenance(provenance);
    return JSON.stringify(result, null, 2);
  };
  
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
          title="Open Dataset Integrity Panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-purple-600 text-white p-3 flex justify-between items-center">
        <h3 className="font-semibold">Dataset Integrity Panel</h3>
        <div className="flex gap-2">
          <button
            onClick={refreshData}
            className="text-white hover:text-gray-200"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
        {/* Dataset State */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Dataset State</h4>
          {datasetState ? (
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(datasetState, null, 2)}
            </pre>
          ) : (
            <button
              onClick={refreshData}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Load State →
            </button>
          )}
        </div>
        
        {/* Step Validations */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Step Validations</h4>
          {stepValidations ? (
            <div className="space-y-2">
              {Object.entries(stepValidations).map(([step, validation]: [string, any]) => (
                <div key={step} className="text-xs">
                  <span className="font-mono font-bold">{AppStep[parseInt(step)]}:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-white ${
                    validation.canAccess 
                      ? (validation.staleness === 'stale' ? 'bg-amber-500' : 'bg-green-500')
                      : 'bg-red-500'
                  }`}>
                    {validation.canAccess ? validation.staleness : validation.reason}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        
        {/* Access Summary */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Access Summary</h4>
          {accessSummary && (
            <div className="text-xs space-y-1">
              <div>
                <span className="font-semibold text-green-600">Accessible:</span>
                <span className="ml-1">
                  {accessSummary.accessible.map((s: AppStep) => AppStep[s]).join(', ')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-red-600">Blocked:</span>
                <span className="ml-1">
                  {accessSummary.blocked.map((s: AppStep) => AppStep[s]).join(', ')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-amber-600">Stale:</span>
                <span className="ml-1">
                  {accessSummary.stale.map((s: AppStep) => AppStep[s]).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Provenance Testing */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Provenance Tests</h4>
          <div className="space-y-2 text-xs">
            {stepData?.validation?.provenance && (
              <div>
                <div className="font-semibold">Validation Provenance:</div>
                <pre className="bg-gray-100 p-1 rounded text-xs overflow-x-auto">
                  {testProvenanceValidation(stepData.validation.provenance)}
                </pre>
              </div>
            )}
            
            {stepData?.features?.provenance && (
              <div>
                <div className="font-semibold">Features Provenance:</div>
                <pre className="bg-gray-100 p-1 rounded text-xs overflow-x-auto">
                  {testProvenanceValidation(stepData.features.provenance)}
                </pre>
              </div>
            )}
            
            {stepData?.model?.provenance && (
              <div>
                <div className="font-semibold">Model Provenance:</div>
                <pre className="bg-gray-100 p-1 rounded text-xs overflow-x-auto">
                  {testProvenanceValidation(stepData.model.provenance)}
                </pre>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Actions</h4>
          <div className="space-y-2">
            <button
              onClick={handleClearDataset}
              className="w-full text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
            >
              Clear Dataset Store
            </button>
            <button
              onClick={handleClearCache}
              className="w-full text-sm bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600"
            >
              Clear Validation Cache
            </button>
            <button
              onClick={() => console.log('Dataset State:', exportDatasetState())}
              className="w-full text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              Log State to Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};