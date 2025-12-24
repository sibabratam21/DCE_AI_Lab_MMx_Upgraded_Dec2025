import React, { useState, useMemo } from 'react';
import { ModelRun } from '../types';
import { RevertedFinalReport } from './RevertedFinalReport';
import { ModelConsistencyPanel } from './ModelConsistencyPanel';
import { generateDualModelLeaderboards, generateModelConsistency } from '../services/consistencyUtils';

interface DualModelReportProps {
  activeModelId: string | null;
  models: ModelRun[];
  selectedChannels: string[];
  onGoToOptimizer: (modelId?: string) => void;
  onRecalibrate?: () => void;
}

export const DualModelReport: React.FC<DualModelReportProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'geo' | 'consistency'>('customer');

  // Generate dual model leaderboards (synthetic for demo)
  const dualLeaderboards = useMemo(() => {
    return generateDualModelLeaderboards(props.models);
  }, [props.models]);

  // Get active models for each lens
  const customerActiveModel = useMemo(() => {
    if (!props.activeModelId) return null;
    return dualLeaderboards.customer.find(m => m.id === props.activeModelId) || null;
  }, [props.activeModelId, dualLeaderboards.customer]);

  const geoActiveModel = useMemo(() => {
    if (!props.activeModelId) return null;
    const baseId = props.activeModelId.replace('_GEO', '');
    return dualLeaderboards.geo.find(m => m.id === `${baseId}_GEO`) || null;
  }, [props.activeModelId, dualLeaderboards.geo]);

  // Generate consistency metrics
  const consistency = useMemo(() => {
    return generateModelConsistency(customerActiveModel, geoActiveModel);
  }, [customerActiveModel, geoActiveModel]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white px-6 pt-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'customer'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>CUSTOMER Report</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('geo')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'geo'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>GEO Report</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('consistency')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'consistency'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Model Comparison</span>
              {consistency && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  consistency.overallAgreementScore >= 80
                    ? 'bg-green-100 text-green-700'
                    : consistency.overallAgreementScore >= 60
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {consistency.overallAgreementScore}%
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Tab Description */}
        <div className="pb-3 pt-2">
          {activeTab === 'customer' && (
            <p className="text-xs text-gray-600">
              Customer-level model attribution and channel performance
            </p>
          )}
          {activeTab === 'geo' && (
            <p className="text-xs text-gray-600">
              Geographic model attribution and market-level insights
            </p>
          )}
          {activeTab === 'consistency' && (
            <p className="text-xs text-gray-600">
              Compare model perspectives and validate assumptions before optimization
            </p>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'customer' && customerActiveModel && (
          <RevertedFinalReport
            {...props}
            activeModelId={customerActiveModel.id}
            models={dualLeaderboards.customer}
          />
        )}

        {activeTab === 'geo' && geoActiveModel && (
          <RevertedFinalReport
            {...props}
            activeModelId={geoActiveModel.id}
            models={dualLeaderboards.geo}
          />
        )}

        {activeTab === 'consistency' && (
          <>
            {consistency ? (
              <ModelConsistencyPanel
                consistency={consistency}
                customerModel={customerActiveModel}
                geoModel={geoActiveModel}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Select a Model to Compare
                  </h3>
                  <p className="text-sm text-gray-600">
                    Choose a model from either CUSTOMER or GEO tab to view consistency analysis
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
