import React, { useState, useMemo, useEffect } from 'react';
import { ModelRun, ChannelDiagnostic as ChannelDiagnosticType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader } from './Loader';
import { selectActiveModelView, createModelDataStores } from '../services/modelSelectors';
import { channelsMatch } from '../utils/channelUtils';
import { GatedContributionChart } from './GatedContributionChart';
import { EnhancedDiagnosticsTable } from './EnhancedDiagnosticsTable';

interface EnhancedModelDetailsProps {
  model: ModelRun;
  models: ModelRun[]; // All models for creating data stores
  onRecalibrate: () => void;
  onRequestFinalize: () => void;
  isRecalibrating: boolean;
  selectedChannels: string[];
  isStale: boolean;
}

const AIExplanation: React.FC<{ model: ModelRun; }> = ({ model }) => {
  const generateExplanation = () => {
    const explanations = [];
    
    // Performance explanation
    if (model.rsq >= 0.85) {
      explanations.push(`Excellent model fit (R² = ${(model.rsq * 100).toFixed(1)}%) with ${model.mape.toFixed(1)}% MAPE indicates strong predictive accuracy across the business.`);
    } else if (model.rsq >= 0.70) {
      explanations.push(`Good model performance (R² = ${(model.rsq * 100).toFixed(1)}%) with ${model.mape.toFixed(1)}% prediction error shows reliable attribution.`);
    } else {
      explanations.push(`Limited model fit (R² = ${(model.rsq * 100).toFixed(1)}%) with ${model.mape.toFixed(1)}% MAPE suggests challenges in capturing business patterns.`);
    }
    
    // ROI explanation
    if (model.roi > 2.0) {
      explanations.push(`Strong economic performance with ${model.roi.toFixed(2)}x blended ROI demonstrates effective marketing efficiency.`);
    } else if (model.roi > 0) {
      explanations.push(`Positive ROI of ${model.roi.toFixed(2)}x shows profitable marketing allocation with optimization opportunities.`);
    } else {
      explanations.push(`Negative ROI of ${model.roi.toFixed(2)}x indicates current marketing mix needs significant rebalancing.`);
    }
    
    // Diagnostic insights
    if (model.diagnostics && model.diagnostics.warning_count > 0) {
      const warnings = [];
      if (model.diagnostics.weak_channels && model.diagnostics.weak_channels.length > 0) {
        warnings.push(`${model.diagnostics.weak_channels.length} channels showing weak statistical significance`);
      }
      if (model.diagnostics.sign_mismatch && model.diagnostics.sign_mismatch.length > 0) {
        warnings.push(`${model.diagnostics.sign_mismatch.length} channels with unexpected coefficient signs`);
      }
      if (model.diagnostics.overfit_risk) {
        warnings.push('potential overfitting detected');
      }
      
      explanations.push(`Model diagnostics flag ${warnings.join(', ')} - review channel selection and data quality.`);
    } else {
      explanations.push('Clean diagnostics with no statistical warnings indicate robust model estimation.');
    }
    
    return explanations;
  };
  
  const explanations = generateExplanation();
  
  return (
    <div className="space-y-3">
      <h5 className="font-medium text-gray-800 text-sm">AI Explanation of Results</h5>
      <div className="text-sm text-gray-700 space-y-2">
        {explanations.map((explanation, idx) => (
          <p key={idx}>{explanation}</p>
        ))}
      </div>
    </div>
  );
};

const DiagnosticsTable: React.FC<{ 
  diagnostics: ChannelDiagnosticType[]; 
  showAdvanced: boolean;
}> = ({ diagnostics, showAdvanced }) => {
  if (diagnostics.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2">Channel</th>
            <th className="p-2">Coeff</th>
            {showAdvanced && <th className="p-2">Std Err</th>}
            <th className="p-2">P-Value</th>
            {showAdvanced && <th className="p-2">95% CI</th>}
            <th className="p-2">Sign</th>
            <th className="p-2">Importance</th>
          </tr>
        </thead>
        <tbody>
          {diagnostics.map(diag => (
            <tr key={diag.name} className="border-b border-gray-100">
              <td className="p-2 font-medium">{diag.name}</td>
              <td className="p-2 font-mono">
                {diag.coefficient !== undefined ? diag.coefficient.toFixed(4) : '-'}
              </td>
              {showAdvanced && (
                <td className="p-2 font-mono">
                  {diag.stderr !== undefined ? diag.stderr.toFixed(4) : '-'}
                </td>
              )}
              <td className="p-2 font-mono">
                <span className={`${
                  diag.pValue !== null && diag.pValue !== undefined 
                    ? diag.pValue > 0.1 ? 'text-red-600' : diag.pValue > 0.05 ? 'text-yellow-600' : 'text-green-600'
                    : ''
                }`}>
                  {diag.pValue !== null && diag.pValue !== undefined ? diag.pValue.toFixed(3) : 'N/A'}
                </span>
              </td>
              {showAdvanced && (
                <td className="p-2 font-mono text-xs">
                  {diag.confidence_interval 
                    ? `[${diag.confidence_interval[0].toFixed(3)}, ${diag.confidence_interval[1].toFixed(3)}]`
                    : '-'
                  }
                </td>
              )}
              <td className="p-2">
                <div className="flex items-center space-x-1">
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    diag.actual_sign === 'positive' ? 'bg-green-100 text-green-700' :
                    diag.actual_sign === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {diag.actual_sign === 'positive' ? '+' : diag.actual_sign === 'negative' ? '-' : '0'}
                  </span>
                  {diag.sign_mismatch && (
                    <span className="text-xs text-yellow-600" title="Unexpected sign">⚠️</span>
                  )}
                </div>
              </td>
              <td className="p-2">
                {diag.importance !== undefined ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-12 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${diag.importance * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{(diag.importance * 100).toFixed(0)}%</span>
                  </div>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const EnhancedModelDetails: React.FC<EnhancedModelDetailsProps> = ({ 
  model, 
  models,
  onRecalibrate, 
  onRequestFinalize, 
  isRecalibrating,
  selectedChannels,
  isStale
}) => {
  const [showParameters, setShowParameters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localChannelMismatch, setLocalChannelMismatch] = useState(false);
  const [includeAllContrib, setIncludeAllContrib] = useState(false); // Feature flag viz.includeAllContrib=false by default
  
  // Use selector for single source of truth
  const modelView = useMemo(() => {
    const { modelById, contributionsById, diagnosticsById } = createModelDataStores(models);
    return selectActiveModelView(model.id, modelById, contributionsById, diagnosticsById);
  }, [model.id, models]);
  
  // Check for channel mismatch
  useEffect(() => {
    const mismatch = !channelsMatch(model, selectedChannels);
    setLocalChannelMismatch(mismatch);
    if (mismatch) {
      console.warn(`[ModelDetails] Channel mismatch detected: model has [${model.channels?.join(', ')}] but selected are [${selectedChannels.join(', ')}]`);
    }
  }, [model, selectedChannels]);
  
  const roiColor = model.roi > 0 ? 'text-green-600' : 'text-red-600';
  const chartColors = { grid: 'rgba(26, 22, 40, 0.1)', text: '#1A1628' };

  // Show stale warning for either provenance stale OR channel mismatch
  if (isStale || localChannelMismatch) {
    return (
      <div className="glass-pane p-6 h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {localChannelMismatch ? 'Channel Mismatch Detected' : 'Model Parameters Outdated'}
          </h3>
          <p className="text-gray-600 mb-2">
            {localChannelMismatch 
              ? `This model was trained with different channels: [${model.channels?.join(', ')}]`
              : 'Feature parameters or channel selections have changed since this model was trained.'}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            {localChannelMismatch 
              ? `Current selection: [${selectedChannels.join(', ')}]`
              : 'Recalibration is required to ensure accurate results.'}
          </p>
          <button
            onClick={onRecalibrate}
            disabled={isRecalibrating}
            className="px-6 py-3 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {isRecalibrating ? 'Training...' : 'Recalibrate Now'}
          </button>
        </div>
      </div>
    );
  }

  // Check data consistency
  if (!modelView.consistent) {
    return (
      <div className="glass-pane p-6 h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Data Inconsistency Detected</h3>
          <p className="text-gray-600 mb-2">Model data is not properly synchronized.</p>
          <p className="text-sm text-gray-500 mb-4">{modelView.inconsistencyReason}</p>
          <button
            onClick={onRecalibrate}
            disabled={isRecalibrating}
            className="px-6 py-3 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {isRecalibrating ? 'Training...' : 'Recalibrate Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-pane p-6 h-full flex flex-col relative">
      {isRecalibrating && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex justify-center items-center rounded-lg z-10 transition-opacity">
          <div className="text-center">
            <Loader />
            <p className="mt-2 font-medium text-gray-600">Training new models...</p>
          </div>
        </div>
      )}
      
      <div className={`flex flex-col h-full ${isRecalibrating ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Active Model: {model.id} ({model.algo.replace(' Regression', '')})
        </h3>
        
        {/* Top Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center mb-6">
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="text-sm text-gray-500">R-Square</div>
            <div className="text-2xl font-bold text-[#32A29B]">{model.rsq.toFixed(2)}</div>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="text-sm text-gray-500">MAPE</div>
            <div className="text-2xl font-bold text-[#32A29B]">{model.mape.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Blended ROI</div>
            <div className={`text-2xl font-bold ${roiColor}`}>${model.roi.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-6">
          {/* AI Explanation */}
          <AIExplanation model={model} />
          
          {/* Gated Channel Contribution Chart - Using selector data */}
          {modelView.contrib && modelView.diag && (
            <GatedContributionChart 
              contributions={modelView.contrib.contributions}
              diagnostics={modelView.diag.diagnostics}
              modelAlgo={model.algo}
              includeAll={includeAllContrib}
              onToggleIncludeAll={setIncludeAllContrib}
              showToggle={true}
            />
          )}

          {/* Diagnostics */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800">Model Diagnostics</h4>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
              >
                {showAdvanced ? 'Simple' : 'Advanced'}
              </button>
            </div>
            
            {/* Warning Summary */}
            {model.diagnostics && model.diagnostics.warning_count > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h5 className="font-medium text-yellow-800 mb-2">⚠️ Diagnostic Warnings ({model.diagnostics.warning_count})</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {model.diagnostics.weak_channels && model.diagnostics.weak_channels.length > 0 && (
                    <li>• Weak channels: {model.diagnostics.weak_channels.join(', ')}</li>
                  )}
                  {model.diagnostics.sign_mismatch && model.diagnostics.sign_mismatch.length > 0 && (
                    <li>• Sign mismatches: {model.diagnostics.sign_mismatch.join(', ')}</li>
                  )}
                  {model.diagnostics.overfit_risk && (
                    <li>• Potential overfitting detected</li>
                  )}
                </ul>
              </div>
            )}
            
            {/* Enhanced Diagnostics Table with Reportability */}
            {modelView.diag && modelView.contrib && (
              <EnhancedDiagnosticsTable 
                diagnostics={modelView.diag.diagnostics}
                contributions={modelView.contrib.contributions}
                modelAlgo={model.algo}
                showAdvanced={showAdvanced}
                includeAll={includeAllContrib}
              />
            )}
          </div>

          {/* Chosen Parameters (Collapsed by default) */}
          <div>
            <button
              onClick={() => setShowParameters(!showParameters)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <h4 className="font-semibold text-gray-800">Chosen Parameters</h4>
              <span className={`transform transition-transform ${showParameters ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {showParameters && (
              <div className="mt-4 space-y-2">
                {model.details.map(detail => (
                  <div key={detail.name} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{detail.name}</span>
                    <div className="flex space-x-2 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        a={detail.adstock.toFixed(2)}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        L={detail.lag}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                        {detail.transform.replace('-transform', '')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-6 space-y-3">
          <button
            onClick={onRecalibrate}
            disabled={isRecalibrating}
            className="w-full bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-base font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecalibrating ? 'Training New Models...' : 'Recalibrate (Create New Models)'}
          </button>
          <button
            onClick={onRequestFinalize}
            className="w-full primary-button text-base font-semibold py-3 flex items-center justify-center gap-2"
          >
            Finalize Model & Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};