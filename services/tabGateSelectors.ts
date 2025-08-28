/**
 * Tab Gate Selectors - Prevent navigation to stale tabs
 */

import { AppStep } from '../types';
import { 
  getCurrentDataset, 
  validateResponseProvenance, 
  isDatasetLoaded, 
  isDataStale 
} from './datasetStore';
import type { DatasetProvenance } from '../utils/datasetHash';

export interface TabGateResult {
  canAccess: boolean;
  reason?: string;
  requiresRefresh: boolean;
  staleness: 'fresh' | 'stale' | 'invalid';
}

export interface StepValidationState {
  step: AppStep;
  hasData: boolean;
  isValid: boolean;
  lastValidated?: number;
  provenance?: DatasetProvenance;
}

// Step-specific validation state cache
let stepValidationCache: Map<AppStep, StepValidationState> = new Map();

/**
 * Check if user can access a specific step
 */
export function canAccessStep(
  targetStep: AppStep,
  currentStep: AppStep,
  stepData?: {
    validation?: { provenance?: DatasetProvenance };
    features?: { provenance?: DatasetProvenance };
    model?: { provenance?: DatasetProvenance };
    report?: { provenance?: DatasetProvenance };
    optimize?: { provenance?: DatasetProvenance };
  }
): TabGateResult {
  
  // Always allow welcome and configure steps
  if (targetStep <= AppStep.Configure) {
    return { canAccess: true, requiresRefresh: false, staleness: 'fresh' };
  }
  
  // Check if dataset is loaded
  if (!isDatasetLoaded()) {
    return {
      canAccess: false,
      reason: 'No dataset loaded',
      requiresRefresh: true,
      staleness: 'invalid'
    };
  }
  
  // Sequential step requirements
  const requiredCompletions = getRequiredCompletions(targetStep);
  
  // Check each required step has valid data
  for (const requiredStep of requiredCompletions) {
    const validation = validateStepData(requiredStep, stepData);
    
    if (!validation.canAccess) {
      return {
        canAccess: false,
        reason: `${AppStep[requiredStep]} step has ${validation.reason}`,
        requiresRefresh: validation.requiresRefresh,
        staleness: validation.staleness
      };
    }
  }
  
  // Check if current step allows forward navigation
  if (targetStep > currentStep + 1) {
    return {
      canAccess: false,
      reason: 'Must complete steps in sequence',
      requiresRefresh: false,
      staleness: 'fresh'
    };
  }
  
  return { canAccess: true, requiresRefresh: false, staleness: 'fresh' };
}

/**
 * Get required completed steps for a target step
 */
function getRequiredCompletions(targetStep: AppStep): AppStep[] {
  switch (targetStep) {
    case AppStep.DataValidation:
      return [];
    case AppStep.FeatureEngineering:
      return [AppStep.DataValidation];
    case AppStep.Modeling:
      return [AppStep.DataValidation, AppStep.FeatureEngineering];
    case AppStep.Report:
      return [AppStep.DataValidation, AppStep.FeatureEngineering, AppStep.Modeling];
    case AppStep.Optimize:
      return [AppStep.DataValidation, AppStep.FeatureEngineering, AppStep.Modeling];
    default:
      return [];
  }
}

/**
 * Validate step-specific data integrity
 */
function validateStepData(
  step: AppStep, 
  stepData?: {
    validation?: { provenance?: DatasetProvenance };
    features?: { provenance?: DatasetProvenance };
    model?: { provenance?: DatasetProvenance };
    report?: { provenance?: DatasetProvenance };
    optimize?: { provenance?: DatasetProvenance };
  }
): TabGateResult {
  
  let provenance: DatasetProvenance | undefined;
  let dataExists = false;
  
  switch (step) {
    case AppStep.DataValidation:
      provenance = stepData?.validation?.provenance;
      dataExists = !!stepData?.validation;
      break;
    case AppStep.FeatureEngineering:
      provenance = stepData?.features?.provenance;
      dataExists = !!stepData?.features;
      break;
    case AppStep.Modeling:
      provenance = stepData?.model?.provenance;
      dataExists = !!stepData?.model;
      break;
    case AppStep.Report:
      provenance = stepData?.report?.provenance;
      dataExists = !!stepData?.report;
      break;
    case AppStep.Optimize:
      provenance = stepData?.optimize?.provenance;
      dataExists = !!stepData?.optimize;
      break;
    default:
      return { canAccess: true, requiresRefresh: false, staleness: 'fresh' };
  }
  
  if (!dataExists) {
    return {
      canAccess: false,
      reason: 'no data',
      requiresRefresh: true,
      staleness: 'invalid'
    };
  }
  
  // Validate provenance if available
  if (provenance) {
    const validation = validateResponseProvenance(provenance);
    
    if (!validation.isValid) {
      return {
        canAccess: false,
        reason: 'dataset version mismatch',
        requiresRefresh: true,
        staleness: 'invalid'
      };
    }
  }
  
  // Check for data staleness
  if (isDataStale()) {
    return {
      canAccess: true, // Allow access but mark as stale
      requiresRefresh: false,
      staleness: 'stale'
    };
  }
  
  return { canAccess: true, requiresRefresh: false, staleness: 'fresh' };
}

/**
 * Get validation status for all steps
 */
export function getAllStepValidations(stepData?: {
  validation?: { provenance?: DatasetProvenance };
  features?: { provenance?: DatasetProvenance };
  model?: { provenance?: DatasetProvenance };
  report?: { provenance?: DatasetProvenance };
  optimize?: { provenance?: DatasetProvenance };
}): Record<AppStep, TabGateResult> {
  
  const results: Record<AppStep, TabGateResult> = {} as any;
  
  // Check all steps
  for (let step = AppStep.Welcome; step <= AppStep.Optimize; step++) {
    results[step] = validateStepData(step, stepData);
  }
  
  return results;
}

/**
 * Check if any step data is stale and needs refresh
 */
export function hasStaleData(stepData?: {
  validation?: { provenance?: DatasetProvenance };
  features?: { provenance?: DatasetProvenance };
  model?: { provenance?: DatasetProvenance };
  report?: { provenance?: DatasetProvenance };
  optimize?: { provenance?: DatasetProvenance };
}): boolean {
  
  if (!isDatasetLoaded()) return true;
  
  const stepValidations = getAllStepValidations(stepData);
  
  return Object.values(stepValidations).some(
    validation => validation.staleness === 'stale' || validation.staleness === 'invalid'
  );
}

/**
 * Get steps that require refresh
 */
export function getStepsRequiringRefresh(stepData?: {
  validation?: { provenance?: DatasetProvenance };
  features?: { provenance?: DatasetProvenance };
  model?: { provenance?: DatasetProvenance };
  report?: { provenance?: DatasetProvenance };
  optimize?: { provenance?: DatasetProvenance };
}): AppStep[] {
  
  const stepValidations = getAllStepValidations(stepData);
  
  return Object.entries(stepValidations)
    .filter(([_, validation]) => validation.requiresRefresh)
    .map(([step, _]) => parseInt(step) as AppStep);
}

/**
 * Clear validation cache
 */
export function clearValidationCache(): void {
  stepValidationCache.clear();
}

/**
 * Get step access summary for UI
 */
export function getStepAccessSummary(
  currentStep: AppStep,
  stepData?: {
    validation?: { provenance?: DatasetProvenance };
    features?: { provenance?: DatasetProvenance };
    model?: { provenance?: DatasetProvenance };
    report?: { provenance?: DatasetProvenance };
    optimize?: { provenance?: DatasetProvenance };
  }
): {
  accessible: AppStep[];
  blocked: AppStep[];
  stale: AppStep[];
  requiresRefresh: AppStep[];
} {
  
  const accessible: AppStep[] = [];
  const blocked: AppStep[] = [];
  const stale: AppStep[] = [];
  const requiresRefresh: AppStep[] = [];
  
  for (let step = AppStep.Welcome; step <= AppStep.Optimize; step++) {
    const gateResult = canAccessStep(step, currentStep, stepData);
    
    if (gateResult.canAccess) {
      accessible.push(step);
      if (gateResult.staleness === 'stale') {
        stale.push(step);
      }
    } else {
      blocked.push(step);
    }
    
    if (gateResult.requiresRefresh) {
      requiresRefresh.push(step);
    }
  }
  
  return { accessible, blocked, stale, requiresRefresh };
}