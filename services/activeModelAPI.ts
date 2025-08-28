/**
 * Active Model API Handler with normalized DTOs and validation
 */

import { 
  ActiveModelResponse, 
  ActiveModelsResponse,
  ModelMetadata,
  ModelContributionsDTO,
  ModelDiagnosticsDTO,
  DiagnosticRow,
  ChannelAlignmentResult,
  ModelValidationResult,
  GetActiveModelRequest,
  GetActiveModelsRequest
} from '../types/api';
import { ModelRun } from '../types';
import { eqSet } from '../utils/channelUtils';

/**
 * Validate that channel arrays are perfectly aligned
 */
export function validateChannelAlignment(
  contributions: ModelContributionsDTO,
  diagnostics: ModelDiagnosticsDTO
): ChannelAlignmentResult {
  const contribSet = new Set(contributions.channels);
  const diagSet = new Set(diagnostics.channels);
  
  const missing_in_contributions = diagnostics.channels.filter(ch => !contribSet.has(ch));
  const missing_in_diagnostics = contributions.channels.filter(ch => !diagSet.has(ch));
  const extra_in_contributions = contributions.channels.filter(ch => !diagSet.has(ch));
  const extra_in_diagnostics = diagnostics.channels.filter(ch => !contribSet.has(ch));
  
  return {
    is_aligned: eqSet(contribSet, diagSet),
    contributions_channels: contributions.channels,
    diagnostics_channels: diagnostics.channels,
    missing_in_contributions,
    missing_in_diagnostics,
    extra_in_contributions,
    extra_in_diagnostics
  };
}

/**
 * Validate complete model data structure
 */
export function validateModelData(
  model_id: string,
  contributions: ModelContributionsDTO,
  diagnostics: ModelDiagnosticsDTO
): ModelValidationResult {
  const errors: string[] = [];
  
  // Check channel alignment
  const channel_alignment = validateChannelAlignment(contributions, diagnostics);
  if (!channel_alignment.is_aligned) {
    errors.push(`Channel arrays not aligned for model ${model_id}`);
  }
  
  // Check array lengths match channels
  const contributions_match = contributions.values.length === contributions.channels.length;
  const diagnostics_match = diagnostics.rows.length === diagnostics.channels.length;
  
  if (!contributions_match) {
    errors.push(`Contributions values array length (${contributions.values.length}) doesn't match channels length (${contributions.channels.length})`);
  }
  
  if (!diagnostics_match) {
    errors.push(`Diagnostics rows array length (${diagnostics.rows.length}) doesn't match channels length (${diagnostics.channels.length})`);
  }
  
  // Check that diagnostic rows match channels by name
  const diagnosticChannels = new Set(diagnostics.rows.map(row => row.channel));
  const expectedChannels = new Set(diagnostics.channels);
  if (!eqSet(diagnosticChannels, expectedChannels)) {
    errors.push(`Diagnostic row channels don't match declared channels array`);
  }
  
  return {
    model_id,
    is_complete: errors.length === 0,
    channel_alignment,
    array_length_check: {
      contributions_match,
      diagnostics_match,
      expected_length: contributions.channels.length,
      contributions_length: contributions.values.length,
      diagnostics_length: diagnostics.rows.length
    },
    errors
  };
}

/**
 * Convert legacy ModelRun to normalized DTOs
 */
export function convertModelRunToDTO(model: ModelRun): {
  metadata: ModelMetadata;
  contributions: ModelContributionsDTO;
  diagnostics: ModelDiagnosticsDTO;
} {
  // Extract metadata
  const metadata: ModelMetadata = {
    id: model.id,
    algorithm: model.algo.includes('Bayesian') ? 'Bayesian' :
               model.algo.includes('GLM') ? 'GLM' :
               model.algo.includes('LightGBM') ? 'LightGBM' : 'NN',
    performance: {
      rsq: model.rsq,
      mape: model.mape,
      roi: model.roi
    },
    training_info: {
      trained_at: new Date(model.provenance?.timestamp || Date.now()).toISOString(),
      data_version: model.provenance?.data_version || 'unknown',
      seed: model.provenance?.seed
    },
    provenance: {
      features_hash: model.provenance?.features_hash || '',
      ranges_hash: model.provenance?.ranges_hash || ''
    }
  };
  
  // Extract channels (consistent ordering)
  const channels = model.channels || model.details.map(d => d.name);
  
  // Create contributions DTO
  const contributions: ModelContributionsDTO = {
    model_id: model.id,
    channels: [...channels], // Defensive copy
    values: channels.map(ch => {
      const detail = model.details.find(d => d.name === ch);
      return detail?.contribution || 0;
    }),
    basis: 'train' // Assuming train data for legacy models
  };
  
  // Create diagnostics DTO based on algorithm type
  const isStatistical = metadata.algorithm === 'GLM' || metadata.algorithm === 'Bayesian';
  
  const diagnosticRows: DiagnosticRow[] = channels.map(ch => {
    const detail = model.details.find(d => d.name === ch);
    const channelDiag = model.diagnostics?.channel_diagnostics?.find(d => d.name === ch);
    
    if (isStatistical) {
      // Statistical model - fill coef, p-value, CI, sign
      return {
        channel: ch,
        coefficient: channelDiag?.coefficient || detail?.contribution || 0,
        p_value: detail?.pValue || channelDiag?.pValue || null,
        ci95_lower: channelDiag?.confidence_interval?.[0] || null,
        ci95_upper: channelDiag?.confidence_interval?.[1] || null,
        sign: channelDiag?.actual_sign || 
              (detail?.contribution && detail.contribution > 0 ? 'positive' : 
               detail?.contribution && detail.contribution < 0 ? 'negative' : 'neutral'),
        importance: null // Not applicable
      };
    } else {
      // Tree/NN model - fill importance only
      return {
        channel: ch,
        coefficient: null,
        p_value: null,
        ci95_lower: null,
        ci95_upper: null,
        sign: null,
        importance: channelDiag?.importance || Math.abs(detail?.contribution || 0) / 100 // Normalize
      };
    }
  });
  
  const diagnostics: ModelDiagnosticsDTO = {
    model_id: model.id,
    channels: [...channels], // Must match contributions.channels
    rows: diagnosticRows,
    summary: {
      weak_channels: model.diagnostics?.weak_channels || [],
      sign_mismatches: model.diagnostics?.sign_mismatch || [],
      overfit_risk: model.diagnostics?.overfit_risk || false,
      warning_count: model.diagnostics?.warning_count || 0
    }
  };
  
  return { metadata, contributions, diagnostics };
}

/**
 * Get single active model with validation
 */
export async function getActiveModel(request: GetActiveModelRequest): Promise<ActiveModelResponse> {
  // This would typically fetch from your data store
  // For demo, we'll simulate the conversion process
  
  try {
    // Simulate fetching model data
    // const rawModel = await fetchModelFromDatabase(request.model_id);
    
    // For now, return mock data to demonstrate the structure
    const mockModel: ModelRun = {
      id: request.model_id,
      algo: 'Bayesian Regression',
      rsq: 0.85,
      mape: 12.5,
      roi: 2.3,
      commentary: 'Mock model',
      channels: ['TV', 'Radio', 'Digital'],
      details: [
        { name: 'TV', included: true, contribution: 45, roi: 2.5, pValue: 0.01, adstock: 0.8, lag: 0, transform: 'Log-transform' },
        { name: 'Radio', included: true, contribution: 30, roi: 2.0, pValue: 0.05, adstock: 0.6, lag: 1, transform: 'Log-transform' },
        { name: 'Digital', included: true, contribution: 25, roi: 1.8, pValue: 0.08, adstock: 0.3, lag: 0, transform: 'S-Curve' }
      ],
      provenance: {
        features_hash: 'abc123',
        ranges_hash: 'def456',
        algo: 'Bayesian',
        data_version: 'v1.0',
        timestamp: Date.now(),
        seed: 42
      },
      diagnostics: {
        weak_channels: [],
        sign_mismatch: [],
        overfit_risk: false,
        warning_count: 0,
        channel_diagnostics: []
      }
    };
    
    // Convert to normalized DTOs
    const { metadata, contributions, diagnostics } = convertModelRunToDTO(mockModel);
    
    // Validate alignment
    const validation = validateModelData(request.model_id, contributions, diagnostics);
    
    return {
      metadata,
      contributions,
      diagnostics,
      is_complete: validation.is_complete,
      validation_errors: validation.errors.length > 0 ? validation.errors : undefined
    };
    
  } catch (error) {
    throw new Error(`Failed to get active model ${request.model_id}: ${error}`);
  }
}

/**
 * Get multiple active models with batch validation
 */
export async function getActiveModels(request: GetActiveModelsRequest): Promise<ActiveModelsResponse> {
  const models: ActiveModelResponse[] = [];
  const incomplete_models: string[] = [];
  
  // Process each requested model
  for (const model_id of request.model_ids) {
    try {
      const modelResponse = await getActiveModel({
        model_id,
        include_diagnostics: request.include_diagnostics,
        basis: request.basis
      });
      
      if (modelResponse.is_complete || !request.exclude_incomplete) {
        models.push(modelResponse);
      } else {
        incomplete_models.push(model_id);
      }
    } catch (error) {
      console.error(`Failed to process model ${model_id}:`, error);
      incomplete_models.push(model_id);
    }
  }
  
  return {
    models,
    incomplete_models,
    total_requested: request.model_ids.length,
    total_returned: models.length
  };
}

/**
 * Health check endpoint for API validation
 */
export function validateAPIContract(): {
  channel_alignment_test: boolean;
  array_length_test: boolean;
  dto_structure_test: boolean;
} {
  // Test channel alignment validation
  const testContribs: ModelContributionsDTO = {
    model_id: 'test',
    channels: ['A', 'B', 'C'],
    values: [1, 2, 3],
    basis: 'train'
  };
  
  const testDiagnostics: ModelDiagnosticsDTO = {
    model_id: 'test',
    channels: ['A', 'B', 'C'], // Should match
    rows: [
      { channel: 'A', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
      { channel: 'B', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null },
      { channel: 'C', coefficient: 0.2, p_value: 0.10, ci95_lower: 0.0, ci95_upper: 0.4, sign: 'neutral', importance: null }
    ],
    summary: {
      weak_channels: ['C'],
      sign_mismatches: [],
      overfit_risk: false,
      warning_count: 1
    }
  };
  
  const validation = validateModelData('test', testContribs, testDiagnostics);
  
  return {
    channel_alignment_test: validation.channel_alignment.is_aligned,
    array_length_test: validation.array_length_check.contributions_match && validation.array_length_check.diagnostics_match,
    dto_structure_test: validation.is_complete
  };
}