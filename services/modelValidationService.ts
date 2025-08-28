/**
 * Model Validation Service - provides validated models with DTO normalization
 */

import React from 'react';
import { ModelRun } from '../types';
import { convertModelRunToDTO, validateModelData } from './activeModelAPI';
import type { ActiveModelResponse } from '../types/api';

export interface ValidatedModelService {
  /** Raw models that passed validation */
  validModels: ModelRun[];
  /** Active model responses with normalized DTOs */
  activeModelResponses: ActiveModelResponse[];
  /** IDs of models that failed validation */
  incompleteModelIds: string[];
  /** Count of models excluded due to validation failures */
  validationStats: {
    total: number;
    complete: number;
    incomplete: number;
    validation_errors: number;
  };
}

/**
 * Validate and normalize a collection of models
 */
export const validateModelsForLeaderboard = async (
  models: ModelRun[]
): Promise<ValidatedModelService> => {
  const validModels: ModelRun[] = [];
  const activeModelResponses: ActiveModelResponse[] = [];
  const incompleteModelIds: string[] = [];
  let validationErrors = 0;

  console.log(`[ModelValidation] Processing ${models.length} models...`);

  for (const model of models) {
    try {
      // Convert to normalized DTOs
      const { metadata, contributions, diagnostics } = convertModelRunToDTO(model);
      
      // Validate channel alignment and array consistency  
      const validation = validateModelData(model.id, contributions, diagnostics);

      if (validation.is_complete) {
        // Model passed validation - include in leaderboard
        validModels.push(model);
        
        // Create active model response
        const activeModel: ActiveModelResponse = {
          metadata,
          contributions,
          diagnostics,
          is_complete: true,
          validation_errors: undefined
        };
        activeModelResponses.push(activeModel);
      } else {
        // Model failed validation - exclude from leaderboard
        incompleteModelIds.push(model.id);
        validationErrors++;
        console.warn(`[ModelValidation] Model ${model.id} excluded:`, validation.errors);
      }
    } catch (error) {
      // Conversion error - exclude model
      incompleteModelIds.push(model.id);
      validationErrors++;
      console.error(`[ModelValidation] Failed to process model ${model.id}:`, error);
    }
  }

  const stats = {
    total: models.length,
    complete: validModels.length,
    incomplete: incompleteModelIds.length,
    validation_errors: validationErrors
  };

  console.log(`[ModelValidation] Results:`, stats);

  return {
    validModels,
    activeModelResponses,
    incompleteModelIds,
    validationStats: stats
  };
};

/**
 * Get active model response by ID with validation
 */
export const getValidatedActiveModel = async (
  model: ModelRun
): Promise<ActiveModelResponse> => {
  const { metadata, contributions, diagnostics } = convertModelRunToDTO(model);
  const validation = validateModelData(model.id, contributions, diagnostics);

  return {
    metadata,
    contributions,
    diagnostics,
    is_complete: validation.is_complete,
    validation_errors: validation.errors.length > 0 ? validation.errors : undefined
  };
};

/**
 * Hook for using validated models in components
 */
export const useValidatedModels = (rawModels: ModelRun[]) => {
  const [validationService, setValidationService] = React.useState<ValidatedModelService | null>(null);
  const [isValidating, setIsValidating] = React.useState(true);

  React.useEffect(() => {
    let isCancelled = false;
    
    const validateModels = async () => {
      setIsValidating(true);
      try {
        const service = await validateModelsForLeaderboard(rawModels);
        if (!isCancelled) {
          setValidationService(service);
        }
      } catch (error) {
        console.error('[ModelValidation] Validation failed:', error);
        if (!isCancelled) {
          // Return empty service on error
          setValidationService({
            validModels: [],
            activeModelResponses: [],
            incompleteModelIds: rawModels.map(m => m.id),
            validationStats: {
              total: rawModels.length,
              complete: 0,
              incomplete: rawModels.length,
              validation_errors: rawModels.length
            }
          });
        }
      } finally {
        if (!isCancelled) {
          setIsValidating(false);
        }
      }
    };

    validateModels();
    
    return () => {
      isCancelled = true;
    };
  }, [rawModels]);

  return {
    validationService,
    isValidating
  };
};