/**
 * Model Training API Service
 * Handles POST /train endpoint for model recalibration
 */

import { ModelRun, FeatureParams } from '../types';
import { generateDemoModels } from './demoSimulation';

interface BaselineParam {
  channel: string;
  adstockDecay: number;
  lagWeeks: number;
  transform: 'Log-transform' | 'Negative Exponential' | 'S-Curve' | 'Power';
  hillK?: number;
  reg?: number;
}

interface BaselineConfig {
  baseline_model_id: string;
  baseline_params: BaselineParam[];
  delta: { decayPct: number; lagSpan: number };
}

interface TrainingRequest {
  selectedChannels: string[];
  paramRanges: FeatureParams[];
  baselineConfig?: BaselineConfig;
  algosEnabled?: string[];
  seed?: number;
  rationale?: string;
  userId?: string;
  dataVersion?: string;
}

interface TrainingResponse {
  success: boolean;
  newModels: ModelRun[];
  message: string;
  trainingId: string;
  baselineInfo?: {
    baseline_model_id: string;
    models_generated: number;
    exploration_method: string;
  };
}

/**
 * POST /train - Train new models with selected channels and parameter ranges
 */
export const trainModels = async (request: TrainingRequest): Promise<TrainingResponse> => {
  console.log('[TrainingAPI] Starting model training with request:', request);
  
  try {
    // Simulate API call delay (replaced by staged loader timing)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Determine training context
    const isBaselineTraining = !!request.baselineConfig;
    const userContext = isBaselineTraining 
      ? `Baseline-aware training from model ${request.baselineConfig!.baseline_model_id}`
      : 'Recalibrated models with updated parameters';
    
    // Generate new models with the selected channels and parameters
    console.log('[TrainingAPI] Generating demo models with:', {
      channels: request.selectedChannels,
      paramRangesCount: request.paramRanges?.length || 0,
      userContext
    });
    
    const newModels = generateDemoModels(
      request.selectedChannels,
      undefined, // userSelections
      userContext,
      request.paramRanges
    );
    
    console.log('[TrainingAPI] Generated models:', {
      count: newModels.length,
      modelIds: newModels.map(m => m.id),
      modelChannels: newModels.map(m => ({ id: m.id, channels: m.channels }))
    });
    
    if (newModels.length === 0) {
      console.error('[TrainingAPI] No models generated! Check generateDemoModels function');
      return {
        success: false,
        newModels: [],
        message: 'No models were generated',
        trainingId: ''
      };
    }
    
    // Mark new models as fresh and new with baseline tracking
    const freshModels = newModels.map((model, index) => {
      const baseModel = {
        ...model,
        isNew: true,
        isStale: false,
        // Update provenance to current settings
        provenance: {
          ...model.provenance,
          timestamp: Date.now(),
          features_hash: JSON.stringify(request.selectedChannels.sort()).slice(0, 8),
          ranges_hash: JSON.stringify(request.paramRanges.map(p => ({ 
            channel: p.channel, 
            adstock: p.adstock, 
            lag: p.lag, 
            transform: p.transform 
          })).sort((a, b) => a.channel.localeCompare(b.channel))).slice(0, 8)
        }
      };
      
      // Add baseline tracking if this is baseline-aware training
      if (isBaselineTraining) {
        const baselineConfig = request.baselineConfig!;
        
        // Calculate per-channel differences from baseline
        const baseline_diff: Record<string, string[]> = {};
        model.details.forEach(detail => {
          const baselineParam = baselineConfig.baseline_params.find(p => p.channel === detail.name);
          if (baselineParam) {
            const diffs: string[] = [];
            
            if (Math.abs(detail.adstock - baselineParam.adstockDecay) > 0.05) {
              diffs.push('adstock');
            }
            if (detail.lag !== baselineParam.lagWeeks) {
              diffs.push('lag');
            }
            if (detail.transform !== baselineParam.transform) {
              diffs.push('transform');
            }
            
            if (diffs.length > 0) {
              baseline_diff[detail.name] = diffs;
            }
          }
        });
        
        // Add baseline tracking to provenance
        baseModel.provenance = {
          ...baseModel.provenance,
          baseline_model_id: baselineConfig.baseline_model_id,
          baseline_diff,
          exploration_method: 'grid_search_centered'
        };
        
        // Update commentary to reflect baseline context
        const changedChannels = Object.keys(baseline_diff).length;
        if (changedChannels > 0) {
          baseModel.commentary += ` Explored ${changedChannels} parameter variations from baseline.`;
        } else {
          baseModel.commentary += ` Similar configuration to baseline with improved convergence.`;
        }
      }
      
      return baseModel;
    });
    
    const trainingId = `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[TrainingAPI] Successfully trained ${freshModels.length} new models`);
    
    const response: TrainingResponse = {
      success: true,
      newModels: freshModels,
      message: isBaselineTraining 
        ? `Successfully trained ${freshModels.length} baseline-aware models`
        : `Successfully trained ${freshModels.length} new models`,
      trainingId
    };
    
    if (isBaselineTraining) {
      response.baselineInfo = {
        baseline_model_id: request.baselineConfig!.baseline_model_id,
        models_generated: freshModels.length,
        exploration_method: 'grid_search_centered'
      };
    }
    
    return response;
    
  } catch (error) {
    console.error('[TrainingAPI] Training failed:', error);
    
    return {
      success: false,
      newModels: [],
      message: `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      trainingId: ''
    };
  }
};

/**
 * Get training status (for future polling if needed)
 */
export const getTrainingStatus = async (trainingId: string) => {
  // Placeholder for future polling implementation
  return {
    id: trainingId,
    status: 'completed' as 'pending' | 'running' | 'completed' | 'failed',
    progress: 100
  };
};