/**
 * Chat integration for baseline-aware recalibration
 */

import { ModelRun, FeatureParams } from '../types';

export interface BaselineRecalibrationIntent {
  type: 'retrain_from_current' | 'adjust_params' | 'lock_unlock_params';
  channels?: string[];
  paramAdjustments?: {
    channel: string;
    param: 'adstock' | 'lag' | 'transform';
    adjustment: string; // e.g., "widen by 15%", "lock", "set to 2 weeks"
  }[];
}

/**
 * Parse chat messages for baseline recalibration intents
 */
export const parseBaselineRecalibrationIntent = (message: string, activeModel?: ModelRun): BaselineRecalibrationIntent | null => {
  const lowerMessage = message.toLowerCase();
  
  // Intent 1: "retrain from current model"
  if (lowerMessage.includes('retrain') && 
      (lowerMessage.includes('current') || lowerMessage.includes('active') || lowerMessage.includes('this model'))) {
    return {
      type: 'retrain_from_current'
    };
  }
  
  // Intent 2: Parameter adjustments like "widen TV adstock by 15%"
  const paramPattern = /(widen|narrow|increase|decrease|lock|unlock)\s+(\w+)\s+(adstock|lag)\s*(?:by\s+(\d+)%?)?/gi;
  const paramMatches = [...message.matchAll(paramPattern)];
  
  if (paramMatches.length > 0) {
    const paramAdjustments = paramMatches.map(match => ({
      channel: match[2],
      param: match[3] as 'adstock' | 'lag',
      adjustment: `${match[1]} by ${match[4] || '20'}%`
    }));
    
    return {
      type: 'adjust_params',
      paramAdjustments
    };
  }
  
  // Intent 3: Lock/unlock specific parameters
  const lockPattern = /(lock|unlock)\s+(\w+)\s+(adstock|lag|transform)/gi;
  const lockMatches = [...message.matchAll(lockPattern)];
  
  if (lockMatches.length > 0) {
    const paramAdjustments = lockMatches.map(match => ({
      channel: match[2],
      param: match[3] as 'adstock' | 'lag',
      adjustment: match[1]
    }));
    
    return {
      type: 'lock_unlock_params',
      paramAdjustments
    };
  }
  
  return null;
};

/**
 * Generate baseline recalibration configuration from chat intent
 */
export const generateBaselineConfigFromIntent = (
  intent: BaselineRecalibrationIntent, 
  activeModel: ModelRun, 
  currentFeatureParams: FeatureParams[]
): {
  selectedChannels: string[];
  paramRanges: FeatureParams[];
  baselineConfig: any;
} => {
  const selectedChannels = activeModel.channels;
  const baselineParams: Record<string, any> = {};
  
  // Extract baseline parameters from active model
  activeModel.details.forEach(detail => {
    baselineParams[detail.name] = {
      channel: detail.name,
      adstockDecay: detail.adstock,
      lagWeeks: detail.lag,
      transform: detail.transform
    };
  });
  
  // Default parameter controls
  const paramControls: Record<string, { locked: boolean; delta: number; lagSpan: number }> = {};
  selectedChannels.forEach(channel => {
    paramControls[channel] = {
      locked: false,
      delta: 0.20, // ±20% default
      lagSpan: 2   // ±2 weeks default
    };
  });
  
  // Apply intent-specific adjustments
  if (intent.type === 'adjust_params' && intent.paramAdjustments) {
    intent.paramAdjustments.forEach(adj => {
      const channel = adj.channel;
      if (paramControls[channel]) {
        if (adj.adjustment.includes('widen') || adj.adjustment.includes('increase')) {
          const percent = parseInt(adj.adjustment.match(/\d+/)?.[0] || '25');
          if (adj.param === 'adstock') {
            paramControls[channel].delta = Math.min(0.5, percent / 100);
          } else if (adj.param === 'lag') {
            paramControls[channel].lagSpan = Math.min(6, Math.ceil(percent / 10));
          }
        } else if (adj.adjustment.includes('narrow') || adj.adjustment.includes('decrease')) {
          const percent = parseInt(adj.adjustment.match(/\d+/)?.[0] || '10');
          if (adj.param === 'adstock') {
            paramControls[channel].delta = Math.max(0.05, percent / 100);
          } else if (adj.param === 'lag') {
            paramControls[channel].lagSpan = Math.max(1, Math.ceil(percent / 20));
          }
        }
      }
    });
  }
  
  if (intent.type === 'lock_unlock_params' && intent.paramAdjustments) {
    intent.paramAdjustments.forEach(adj => {
      const channel = adj.channel;
      if (paramControls[channel]) {
        paramControls[channel].locked = adj.adjustment === 'lock';
      }
    });
  }
  
  // Generate parameter ranges
  const paramRanges = selectedChannels.map(channel => {
    const baseline = baselineParams[channel];
    const control = paramControls[channel];
    
    if (control.locked) {
      return {
        channel,
        adstock: { min: baseline.adstockDecay, max: baseline.adstockDecay },
        lag: { min: baseline.lagWeeks, max: baseline.lagWeeks },
        transform: baseline.transform,
        rationale: `Locked to baseline via chat: ${baseline.adstockDecay}/${baseline.lagWeeks}`
      };
    } else {
      const adstockLo = Math.max(0.0, baseline.adstockDecay * (1 - control.delta));
      const adstockHi = Math.min(0.9, baseline.adstockDecay * (1 + control.delta));
      
      const lagLo = Math.max(0, baseline.lagWeeks - control.lagSpan);
      const lagHi = Math.min(12, baseline.lagWeeks + control.lagSpan);
      
      return {
        channel,
        adstock: { min: adstockLo, max: adstockHi },
        lag: { min: lagLo, max: lagHi },
        transform: baseline.transform,
        rationale: `Chat-adjusted: ±${(control.delta * 100).toFixed(0)}% adstock, ±${control.lagSpan}w lag`
      };
    }
  });
  
  return {
    selectedChannels,
    paramRanges,
    baselineConfig: {
      baseline_model_id: activeModel.id,
      baseline_params: selectedChannels.map(ch => baselineParams[ch]),
      delta: {
        decayPct: Math.max(...Object.values(paramControls).map(c => c.delta)),
        lagSpan: Math.max(...Object.values(paramControls).map(c => c.lagSpan))
      }
    }
  };
};

/**
 * Generate response for baseline recalibration chat intent
 */
export const generateBaselineRecalibrationResponse = (
  intent: BaselineRecalibrationIntent,
  activeModel: ModelRun
): string => {
  const modelName = `${activeModel.algo} (R²=${(activeModel.rsq * 100).toFixed(1)}%)`;
  
  switch (intent.type) {
    case 'retrain_from_current':
      return `I'll retrain using your current ${modelName} as a baseline. This will explore parameter ranges centered around the proven values: ${activeModel.channels.map(ch => {
        const detail = activeModel.details.find(d => d.name === ch);
        return `${ch}(${detail?.adstock.toFixed(2)}/${detail?.lag}w)`;
      }).join(', ')}. Opening the baseline-aware recalibration wizard...`;
      
    case 'adjust_params':
      if (intent.paramAdjustments && intent.paramAdjustments.length > 0) {
        const adjustments = intent.paramAdjustments.map(adj => 
          `${adj.channel} ${adj.param} ${adj.adjustment}`
        ).join(', ');
        
        return `I'll ${adjustments} from the current ${modelName} baseline. This focused exploration will help optimize performance while maintaining the proven foundation. Starting recalibration...`;
      }
      return `I'll adjust the parameters from your current ${modelName} baseline. Opening recalibration wizard...`;
      
    case 'lock_unlock_params':
      if (intent.paramAdjustments && intent.paramAdjustments.length > 0) {
        const locks = intent.paramAdjustments.map(adj => 
          `${adj.adjustment} ${adj.channel} ${adj.param}`
        ).join(', ');
        
        return `I'll ${locks} while exploring other parameters around your ${modelName} baseline. This ensures stability for critical channels while optimizing others. Configuring training...`;
      }
      return `I'll adjust parameter locks from your current ${modelName} baseline. Opening recalibration wizard...`;
      
    default:
      return `I'll help you retrain from your current ${modelName} baseline. Opening the recalibration wizard...`;
  }
};

// Example chat interactions
export const BASELINE_CHAT_EXAMPLES = [
  {
    user: "retrain from current model",
    response: "I'll retrain using your current model as baseline, exploring ranges around proven parameters.",
    action: "opens baseline-aware wizard with current model prefilled"
  },
  {
    user: "widen TV adstock by 15% and lock Search lag", 
    response: "I'll increase TV adstock exploration to ±15% while keeping Search lag fixed at baseline.",
    action: "opens wizard with TV adstock delta=0.15, Search lag locked"
  },
  {
    user: "lock Radio parameters and retrain",
    response: "I'll lock Radio to baseline values while exploring other channels.",
    action: "opens wizard with Radio parameters locked"
  }
];