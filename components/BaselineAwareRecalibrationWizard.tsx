import React, { useState, useMemo } from 'react';
import { FeatureParams, ModelRun, ModelDetail } from '../types';

interface BaselineParam {
  channel: string;
  adstockDecay: number;
  lagWeeks: number;
  transform: 'Log-transform' | 'Negative Exponential' | 'S-Curve' | 'Power';
  hillK?: number; // For S-curve
  reg?: number; // Regularization
}

interface ParamControl {
  locked: boolean;
  delta: number; // percentage delta for ranges (0.10 = ±10%)
  lagSpan: number; // integer span for lag ranges
}

interface BaselineAwareRecalibrationWizardProps {
  currentChannels: string[];
  featureParams: FeatureParams[];
  activeModel: ModelRun | null; // For baseline prefilling
  onRecalibrate: (config: {
    selectedChannels: string[];
    paramRanges: FeatureParams[];
    baselineConfig?: {
      baseline_model_id: string;
      baseline_params: BaselineParam[];
      delta: { decayPct: number; lagSpan: number };
    };
  }) => void;
  onCancel: () => void;
  isRecalibrating: boolean;
}

export const BaselineAwareRecalibrationWizard: React.FC<BaselineAwareRecalibrationWizardProps> = ({
  currentChannels,
  featureParams,
  activeModel,
  onRecalibrate,
  onCancel,
  isRecalibrating
}) => {
  const [step, setStep] = useState<'channels' | 'parameters' | 'confirm'>('channels');
  const [useBaseline, setUseBaseline] = useState<boolean>(!!activeModel);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    activeModel?.channels || currentChannels
  );
  
  // Extract baseline parameters from active model
  const baselineParams = useMemo(() => {
    if (!activeModel) return {};
    
    const params: Record<string, BaselineParam> = {};
    activeModel.details.forEach((detail: ModelDetail) => {
      params[detail.name] = {
        channel: detail.name,
        adstockDecay: detail.adstock,
        lagWeeks: detail.lag,
        transform: detail.transform,
        // These would come from extended model data in a real implementation
        hillK: 2.0, // Default S-curve parameter
        reg: 0.1   // Default regularization
      };
    });
    
    return params;
  }, [activeModel]);

  const [paramControls, setParamControls] = useState<Record<string, ParamControl>>(() => {
    const controls: Record<string, ParamControl> = {};
    (activeModel?.channels || currentChannels).forEach(channel => {
      controls[channel] = {
        locked: false,
        delta: 0.20, // ±20% default
        lagSpan: 2   // ±2 weeks default
      };
    });
    return controls;
  });

  const channelsChanged = useMemo(() => {
    if (!activeModel) return false;
    const activeSet = new Set(activeModel.channels);
    const selectedSet = new Set(selectedChannels);
    return activeSet.size !== selectedSet.size || 
           ![...activeSet].every(ch => selectedSet.has(ch));
  }, [activeModel, selectedChannels]);

  // Generate parameter ranges from baseline
  const generateParamRanges = (): FeatureParams[] => {
    return selectedChannels.map(channel => {
      const baseline = baselineParams[channel];
      const control = paramControls[channel] || { locked: false, delta: 0.20, lagSpan: 2 };
      
      if (!baseline) {
        // Fall back to original feature params if no baseline
        const original = featureParams.find(p => p.channel === channel);
        return original || {
          channel,
          adstock: { min: 0.1, max: 0.6 },
          lag: { min: 0, max: 3 },
          transform: 'Log-transform',
          rationale: 'Default parameters - no baseline available'
        };
      }

      if (control.locked) {
        // Locked parameter - min = max = baseline
        return {
          channel,
          adstock: { min: baseline.adstockDecay, max: baseline.adstockDecay },
          lag: { min: baseline.lagWeeks, max: baseline.lagWeeks },
          transform: baseline.transform,
          rationale: `Locked to baseline: adstock=${baseline.adstockDecay}, lag=${baseline.lagWeeks}`
        };
      } else {
        // Generate ranges around baseline
        const adstockLo = Math.max(0.0, baseline.adstockDecay * (1 - control.delta));
        const adstockHi = Math.min(0.9, baseline.adstockDecay * (1 + control.delta));
        
        const lagLo = Math.max(0, baseline.lagWeeks - control.lagSpan);
        const lagHi = Math.min(12, baseline.lagWeeks + control.lagSpan);
        
        return {
          channel,
          adstock: { min: adstockLo, max: adstockHi },
          lag: { min: lagLo, max: lagHi },
          transform: baseline.transform,
          rationale: `Baseline-centered: ±${(control.delta * 100).toFixed(0)}% adstock, ±${control.lagSpan}w lag from ${baseline.adstockDecay.toFixed(2)}/${baseline.lagWeeks}`
        };
      }
    });
  };

  const handleChannelToggle = (channel: string) => {
    setSelectedChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const handleParamControlChange = (channel: string, field: keyof ParamControl, value: any) => {
    setParamControls(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: value
      }
    }));
  };

  const handleConfirmAndRecalibrate = () => {
    const paramRanges = generateParamRanges();
    
    const config: any = {
      selectedChannels,
      paramRanges
    };

    if (useBaseline && activeModel) {
      config.baselineConfig = {
        baseline_model_id: activeModel.id,
        baseline_params: selectedChannels.map(ch => baselineParams[ch]).filter(Boolean),
        delta: {
          decayPct: Math.max(...Object.values(paramControls).map(c => c.delta)),
          lagSpan: Math.max(...Object.values(paramControls).map(c => c.lagSpan))
        }
      };
    }

    onRecalibrate(config);
  };

  const getWarningForChannel = (channel: string): string | null => {
    if (!activeModel) return null;
    
    const diag = activeModel.diagnostics?.channel_diagnostics?.find(d => d.name === channel);
    if (!diag) return null;
    
    if (diag.sign_mismatch) return 'Sign mismatch detected - unexpected coefficient direction';
    if ((diag.pValue && diag.pValue > 0.1) || (diag.importance && diag.importance < 0.1)) {
      return 'Weak statistical significance - consider excluding or adjusting ranges';
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Baseline-Aware Recalibration</h2>
          <button
            onClick={onCancel}
            disabled={isRecalibrating}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6">
          {step === 'channels' && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Step 1: Channel Selection
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose which channels to include in the recalibration. Training will focus on these selected channels.
                </p>

                {activeModel && (
                  <div className="mb-4">
                    <label className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <input
                        type="checkbox"
                        checked={useBaseline}
                        onChange={(e) => setUseBaseline(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <div>
                        <span className="font-medium text-blue-900">
                          Start from active model (recommended)
                        </span>
                        <p className="text-xs text-blue-700 mt-1">
                          Use "{activeModel.algo}" parameters as baseline for focused exploration around proven results
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {channelsChanged && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <span className="text-yellow-600 text-sm">⚠️</span>
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium mb-1">Channel set changed:</p>
                        <p>Previous results will be marked as legacy until training completes</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3 mb-6">
                {(useBaseline ? activeModel?.channels || currentChannels : currentChannels).map(channel => {
                  const warning = getWarningForChannel(channel);
                  const baseline = baselineParams[channel];
                  
                  return (
                    <div 
                      key={channel}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                        selectedChannels.includes(channel)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(channel)}
                          onChange={() => handleChannelToggle(channel)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{channel}</div>
                          {baseline && (
                            <div className="text-xs text-gray-500">
                              Baseline: Adstock {baseline.adstockDecay.toFixed(2)} | 
                              Lag {baseline.lagWeeks}w | {baseline.transform}
                            </div>
                          )}
                          {warning && (
                            <div className="text-xs text-yellow-600 mt-1">
                              ⚠️ {warning}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {selectedChannels.length} channels selected
                  {useBaseline && activeModel && (
                    <span className="ml-2 text-blue-600">
                      (from {activeModel.algo})
                    </span>
                  )}
                </div>
                <div className="space-x-3">
                  <button
                    onClick={onCancel}
                    disabled={isRecalibrating}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('parameters')}
                    disabled={selectedChannels.length === 0 || isRecalibrating}
                    className="px-6 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Continue to Parameters
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'parameters' && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Step 2: Parameter Controls
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Fine-tune parameter ranges for each channel. Ranges will be centered around baseline values.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {selectedChannels.map(channel => {
                  const baseline = baselineParams[channel];
                  const control = paramControls[channel] || { locked: false, delta: 0.20, lagSpan: 2 };
                  
                  return (
                    <div key={channel} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">{channel}</h4>
                      
                      {baseline && (
                        <div className="bg-gray-50 rounded p-3 mb-3">
                          <div className="text-sm">
                            <span className="font-medium">Baseline:</span>
                            <span className="ml-2">
                              Adstock: {baseline.adstockDecay.toFixed(2)} | 
                              Lag: {baseline.lagWeeks}w | 
                              Transform: {baseline.transform}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="flex items-center space-x-2 mb-2">
                            <input
                              type="checkbox"
                              checked={control.locked}
                              onChange={(e) => handleParamControlChange(channel, 'locked', e.target.checked)}
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-medium">Lock to baseline</span>
                          </label>
                          <p className="text-xs text-gray-500">
                            Forces min = max = baseline value
                          </p>
                        </div>

                        {!control.locked && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Adstock Range (±{(control.delta * 100).toFixed(0)}%)
                              </label>
                              <input
                                type="range"
                                min="0.05"
                                max="0.50"
                                step="0.05"
                                value={control.delta}
                                onChange={(e) => handleParamControlChange(channel, 'delta', parseFloat(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>±5%</span>
                                <span>±{(control.delta * 100).toFixed(0)}%</span>
                                <span>±50%</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Lag Range (±{control.lagSpan} weeks)
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="6"
                                step="1"
                                value={control.lagSpan}
                                onChange={(e) => handleParamControlChange(channel, 'lagSpan', parseInt(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>±1w</span>
                                <span>±{control.lagSpan}w</span>
                                <span>±6w</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStep('channels')}
                  disabled={isRecalibrating}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Back
                </button>
                <div className="space-x-3">
                  <button
                    onClick={onCancel}
                    disabled={isRecalibrating}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={isRecalibrating}
                    className="px-6 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Review & Train
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Step 3: Confirm Training Configuration
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review your configuration before starting the training process.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Selected Channels ({selectedChannels.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedChannels.map(channel => (
                      <span 
                        key={channel}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>

                {useBaseline && activeModel && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Baseline Model: {activeModel.algo}
                    </h4>
                    <div className="text-sm text-blue-800">
                      <p>R²: {(activeModel.rsq * 100).toFixed(1)}% | MAPE: {activeModel.mape.toFixed(1)}% | ROI: {activeModel.roi.toFixed(2)}x</p>
                      <p className="mt-1">Training will explore parameter ranges centered around this model's values</p>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Parameter Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {selectedChannels.map(channel => {
                      const control = paramControls[channel];
                      const baseline = baselineParams[channel];
                      
                      return (
                        <div key={channel} className="bg-white p-2 rounded border">
                          <div className="font-medium">{channel}</div>
                          {control?.locked ? (
                            <div className="text-gray-600">🔒 Locked to baseline</div>
                          ) : (
                            <div className="text-gray-600">
                              ±{((control?.delta || 0.2) * 100).toFixed(0)}% adstock, 
                              ±{control?.lagSpan || 2}w lag
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStep('parameters')}
                  disabled={isRecalibrating}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Back
                </button>
                <div className="space-x-3">
                  <button
                    onClick={onCancel}
                    disabled={isRecalibrating}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAndRecalibrate}
                    disabled={isRecalibrating}
                    className="px-6 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRecalibrating ? 'Training New Models...' : 'Start Training'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};