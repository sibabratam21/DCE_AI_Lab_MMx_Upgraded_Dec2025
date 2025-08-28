import React, { useState } from 'react';
import { FeatureParams } from '../types';

interface RecalibrationWizardProps {
  currentChannels: string[];
  featureParams: FeatureParams[];
  onRecalibrate: (selectedChannels: string[], updatedParams?: FeatureParams[]) => void;
  onCancel: () => void;
  isRecalibrating: boolean;
}

export const RecalibrationWizard: React.FC<RecalibrationWizardProps> = ({
  currentChannels,
  featureParams,
  onRecalibrate,
  onCancel,
  isRecalibrating
}) => {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(currentChannels);
  const [step, setStep] = useState<'channels' | 'confirm'>('channels');
  
  const handleChannelToggle = (channel: string) => {
    setSelectedChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };
  
  const handleConfirmAndRecalibrate = () => {
    // Filter feature params to only include selected channels
    const filteredParams = featureParams.filter(param => 
      selectedChannels.includes(param.channel)
    );
    
    onRecalibrate(selectedChannels, filteredParams);
  };
  
  const channelStats = featureParams.reduce((acc, param) => {
    acc[param.channel] = {
      adstock: `${param.adstock.min}-${param.adstock.max}`,
      lag: `${param.lag.min}-${param.lag.max}`,
      transform: param.transform
    };
    return acc;
  }, {} as Record<string, { adstock: string; lag: string; transform: string }>);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Recalibration Wizard</h2>
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
                  Select Channels for New Models
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose which channels to include in the recalibration. This will create entirely new models using only the selected channels.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-600 text-sm">ℹ️</span>
                    <div className="text-xs text-blue-800">
                      <p className="font-medium mb-1">Important:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Removing channels will create new models without those variables</li>
                        <li>Parameters will stay within your defined ranges</li>
                        <li>This process takes 30-60 seconds to complete</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                {featureParams.map(param => (
                  <div 
                    key={param.channel}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                      selectedChannels.includes(param.channel)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(param.channel)}
                        onChange={() => handleChannelToggle(param.channel)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{param.channel}</div>
                        <div className="text-xs text-gray-500">
                          Adstock: {channelStats[param.channel]?.adstock} | 
                          Lag: {channelStats[param.channel]?.lag} | 
                          Transform: {channelStats[param.channel]?.transform}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {param.rationale.slice(0, 60)}...
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {selectedChannels.length} of {featureParams.length} channels selected
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
                    onClick={() => setStep('confirm')}
                    disabled={selectedChannels.length === 0 || isRecalibrating}
                    className="px-6 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </>
          )}
          
          {step === 'confirm' && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm Recalibration
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review your selections before starting the recalibration process.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
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
              
              {selectedChannels.length !== currentChannels.length && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Channel Selection Changed</p>
                      <p>
                        You've {selectedChannels.length < currentChannels.length ? 'removed' : 'modified'} channels from your model. 
                        This will generate entirely new models that may have different performance characteristics.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
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
                    onClick={handleConfirmAndRecalibrate}
                    disabled={isRecalibrating}
                    className="px-6 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRecalibrating ? 'Training New Models...' : 'Start Recalibration'}
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