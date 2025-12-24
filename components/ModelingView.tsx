import React, { useState, useMemo } from 'react';
import { ModelRun, FeatureParams } from '../types';
import { EnhancedModelLeaderboard } from './EnhancedModelLeaderboard';
import { EnhancedModelDetails } from './EnhancedModelDetails';
import { ModelCompare } from './ModelCompare';
import { RecalibrationWizard } from './RecalibrationWizard';
import { BaselineAwareRecalibrationWizard } from './BaselineAwareRecalibrationWizard';
import { useValidatedModels } from '../services/modelValidationService';
import { useModelProgress } from '../hooks/useModelProgress';
import { trainModels } from '../services/trainingAPI';

interface ModelingViewProps {
    models: ModelRun[];
    selectedChannels: string[];
    activeModelId: string | null;
    onSetActiveModel: (id: string | null) => void;
    onModelChange: (model: ModelRun) => void;
    onRequestFinalize: () => void;
    isRecalibrating: boolean;
    onRecalibrate: (selectedChannels?: string[], updatedParams?: FeatureParams[]) => void;
    onModelsUpdated?: (newModels: ModelRun[]) => void; // Callback to append new models
    currentFeaturesHash?: string;
    currentRangesHash?: string;
    featureParams: FeatureParams[];
    currentStep?: string; // For triggering abort on tab changes
}


export const ModelingView: React.FC<ModelingViewProps> = ({ 
    models, 
    selectedChannels, 
    activeModelId, 
    onSetActiveModel, 
    onModelChange, 
    onRequestFinalize, 
    isRecalibrating,
    onRecalibrate,
    currentFeaturesHash = '',
    currentRangesHash = '',
    featureParams,
    currentStep = 'modeling',
    onModelsUpdated
}) => {
    const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
    const [showCompare, setShowCompare] = useState(false);
    const [showRecalibrationWizard, setShowRecalibrationWizard] = useState(false);
    const [useBaselineWizard, setUseBaselineWizard] = useState(true); // Default to baseline-aware
    
    // Staged progress hook - aborts on currentStep changes
    const modelProgress = useModelProgress(currentStep);
    
    // Validate models and filter incomplete ones
    const { validationService, isValidating } = useValidatedModels(models);
    
    // Use validated models for leaderboard (excludes incomplete models)
    const validatedModels = validationService?.validModels || [];
    const incompleteCount = validationService?.incompleteModelIds?.length || 0;
    
    // Active model from validated models only
    const activeModel = validatedModels.find(m => m.id === activeModelId);
    
    // Check if active model is stale
    const isActiveModelStale = useMemo(() => {
        if (!activeModel || !activeModel.provenance) return false;
        return activeModel.provenance.features_hash !== currentFeaturesHash || 
               activeModel.provenance.ranges_hash !== currentRangesHash;
    }, [activeModel, currentFeaturesHash, currentRangesHash]);
    
    const handleToggleModelSelection = (id: string) => {
        setSelectedModelIds(prev => 
            prev.includes(id) ? prev.filter(modelId => modelId !== id) : [...prev, id]
        );
    };
    
    const handleCompareModels = () => {
        setShowCompare(true);
    };
    
    const handleRecalibrate = async (configOrChannels?: any, updatedParams?: FeatureParams[]) => {
        // Handle both old API (selectedChannels, updatedParams) and new API (config object)
        let selectedChannels: string[];
        let paramRanges: FeatureParams[];
        let baselineConfig: any = undefined;
        
        if (configOrChannels && typeof configOrChannels === 'object' && 'selectedChannels' in configOrChannels) {
            // New baseline-aware API
            const config = configOrChannels;
            selectedChannels = config.selectedChannels;
            paramRanges = config.paramRanges;
            baselineConfig = config.baselineConfig;
        } else {
            // Legacy API
            selectedChannels = configOrChannels || [];
            paramRanges = updatedParams || featureParams;
        }
        
        console.log('[ModelingView] Starting recalibration with config:', {
            selectedChannels,
            paramRangesCount: paramRanges.length,
            hasBaselineConfig: !!baselineConfig,
            baselineModelId: baselineConfig?.baseline_model_id
        });
        
        setShowRecalibrationWizard(false);
        
        // Wrap the training API call in staged progress
        try {
            const result = await modelProgress.executeWithProgress(async () => {
                console.log('[ModelingView] Calling trainModels API...');
                // POST /train with baseline-aware configuration
                const response = await trainModels({
                    selectedChannels,
                    paramRanges,
                    baselineConfig,
                    rationale: baselineConfig ? 'Baseline-aware recalibration' : 'Standard recalibration'
                });
                
                console.log('[ModelingView] TrainModels API response:', {
                    success: response?.success,
                    newModelsCount: response?.newModels?.length,
                    message: response?.message,
                    fullResponse: response
                });
                
                if (!response || !response.success) {
                    console.error('[ModelingView] Training failed:', response);
                    throw new Error(response?.message || 'Training failed - no response');
                }
                
                return response;
            });
            
            console.log('[ModelingView] Training completed with result:', {
                resultExists: !!result,
                resultType: typeof result,
                hasSuccess: result?.success,
                hasNewModels: !!result?.newModels,
                newModelsLength: result?.newModels?.length,
                fullResult: result
            });
            
            if (result?.success && result.newModels.length > 0) {
                console.log(`[ModelingView] Adding ${result.newModels.length} new models:`, result.newModels.map(m => m.id));
                
                // Append new candidates to existing models
                if (onModelsUpdated) {
                    onModelsUpdated(result.newModels);
                    console.log('[ModelingView] Called onModelsUpdated callback');
                } else {
                    console.warn('[ModelingView] onModelsUpdated callback not provided');
                }
                
                // Call original recalibrate to update parent state
                onRecalibrate(selectedChannels, paramRanges);
                
                console.log(`[ModelingView] Successfully added ${result.newModels.length} new models`);
            } else {
                console.warn('[ModelingView] No new models to add:', { 
                    success: result?.success, 
                    modelCount: result?.newModels?.length 
                });
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('[ModelingView] Recalibration failed:', error);
                // Could show error toast here
            }
        }
    };
    
    const handleShowRecalibrationWizard = () => {
        setShowRecalibrationWizard(true);
    };
    
    const selectedModels = models.filter(m => selectedModelIds.includes(m.id));
    
    // Listen for compare event from leaderboard
    React.useEffect(() => {
        const handleCompareEvent = () => {
            setShowCompare(true);
        };
        
        window.addEventListener('modelsCompare', handleCompareEvent);
        return () => window.removeEventListener('modelsCompare', handleCompareEvent);
    }, []);

    // Gate rendering on loading state
    if (modelProgress.loading) {
        return (
            <div className="flex h-full items-center justify-center p-6">
                <div className="glass-pane p-8 max-w-md w-full text-center">
                    <div className="mb-6">
                        <div className="w-16 h-16 mx-auto mb-4">
                            <div className="relative w-full h-full">
                                <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                                <div 
                                    className="absolute inset-0 border-4 border-[#EC7200] rounded-full border-t-transparent animate-spin"
                                    style={{ transform: 'rotate(0deg)' }}
                                ></div>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{modelProgress.stage}</h3>
                        <p className="text-gray-600 text-sm mb-4">{modelProgress.label}</p>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div 
                            className="bg-[#EC7200] h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${modelProgress.progress}%` }}
                        ></div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                        {Math.round(modelProgress.progress)}% complete
                    </div>
                    
                    <button
                        onClick={modelProgress.abort}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel Training
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex h-full p-4 md:p-6 gap-6">
                {/* Enhanced Leaderboard */}
                <EnhancedModelLeaderboard
                    models={validatedModels}
                    selectedChannels={selectedChannels}
                    activeModelId={activeModelId}
                    selectedModelIds={selectedModelIds}
                    onSetActiveModel={onSetActiveModel}
                    onToggleModelSelection={handleToggleModelSelection}
                    onRecalibrate={handleShowRecalibrationWizard}
                    isRecalibrating={modelProgress.loading || isValidating}
                    currentFeaturesHash={currentFeaturesHash}
                    currentRangesHash={currentRangesHash}
                />

                {/* Enhanced Model Details */}
                <div className="w-1/2">
                    {activeModel ? (
                        <EnhancedModelDetails
                            model={activeModel}
                            models={validatedModels}
                            onRecalibrate={handleShowRecalibrationWizard}
                            onRequestFinalize={onRequestFinalize}
                            isRecalibrating={isRecalibrating}
                            selectedChannels={selectedChannels}
                            isStale={isActiveModelStale}
                        />
                    ) : (
                        <div className="glass-pane h-full flex flex-col items-center justify-center text-center p-8">
                            <h3 className="text-xl font-semibold text-gray-900">Select a Model</h3>
                            <p className="text-gray-600 mt-2">Click a model from the leaderboard on the left to view its detailed results and diagnostics.</p>
                            {incompleteCount > 0 && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-yellow-800 text-sm">
                                        ⚠️ {incompleteCount} model{incompleteCount !== 1 ? 's' : ''} excluded due to validation failures
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Model Compare Modal */}
            {showCompare && selectedModels.length >= 2 && selectedModels.length <= 3 && (
                <ModelCompare 
                    models={selectedModels}
                    onClose={() => setShowCompare(false)}
                />
            )}
            
            {/* Recalibration Wizard */}
            {showRecalibrationWizard && (
                <BaselineAwareRecalibrationWizard
                    currentChannels={selectedChannels}
                    featureParams={featureParams}
                    activeModel={activeModel}
                    onRecalibrate={handleRecalibrate}
                    onCancel={() => setShowRecalibrationWizard(false)}
                    isRecalibrating={modelProgress.loading}
                />
            )}
        </>
    );
};