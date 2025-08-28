/**
 * Normalized API DTOs for model data exchange
 */

// Base model metadata
export interface ModelMetadata {
  id: string;
  algorithm: 'GLM' | 'Bayesian' | 'LightGBM' | 'NN';
  performance: {
    rsq: number;
    mape: number;
    roi: number;
  };
  training_info: {
    trained_at: string; // ISO timestamp
    data_version: string;
    seed?: number;
  };
  provenance: {
    features_hash: string;
    ranges_hash: string;
  };
}

// Normalized contributions DTO
export interface ModelContributionsDTO {
  model_id: string;
  channels: string[];
  values: number[]; // Must align with channels array
  basis: 'holdout' | 'train';
  metadata?: {
    total_contribution: number;
    currency?: string;
  };
}

// Diagnostic row for statistical models
export interface StatisticalDiagnosticRow {
  channel: string;
  coefficient: number;
  p_value: number | null;
  ci95_lower: number | null;
  ci95_upper: number | null;
  sign: 'positive' | 'negative' | 'neutral';
  importance: null; // Not applicable for statistical models
}

// Diagnostic row for tree/NN models
export interface TreeNNDiagnosticRow {
  channel: string;
  coefficient: null; // Not applicable for tree/NN models
  p_value: null;
  ci95_lower: null;
  ci95_upper: null;
  sign: null;
  importance: number; // 0-1 feature importance
}

// Union type for all diagnostic rows
export type DiagnosticRow = StatisticalDiagnosticRow | TreeNNDiagnosticRow;

// Normalized diagnostics DTO
export interface ModelDiagnosticsDTO {
  model_id: string;
  channels: string[]; // Must align with contributions.channels
  rows: DiagnosticRow[]; // Must align with channels array
  summary: {
    weak_channels: string[];
    sign_mismatches: string[];
    overfit_risk: boolean;
    warning_count: number;
  };
}

// Complete model response
export interface ActiveModelResponse {
  metadata: ModelMetadata;
  contributions: ModelContributionsDTO;
  diagnostics: ModelDiagnosticsDTO;
  is_complete: boolean; // false if arrays don't align
  validation_errors?: string[];
}

// Batch response for multiple models
export interface ActiveModelsResponse {
  models: ActiveModelResponse[];
  incomplete_models: string[]; // IDs of models excluded due to alignment issues
  total_requested: number;
  total_returned: number;
}

// Request DTOs
export interface GetActiveModelRequest {
  model_id: string;
  include_diagnostics?: boolean;
  basis?: 'holdout' | 'train';
}

export interface GetActiveModelsRequest {
  model_ids: string[];
  include_diagnostics?: boolean;
  basis?: 'holdout' | 'train';
  exclude_incomplete?: boolean; // Default: true
}

// Validation result types
export interface ChannelAlignmentResult {
  is_aligned: boolean;
  contributions_channels: string[];
  diagnostics_channels: string[];
  missing_in_contributions: string[];
  missing_in_diagnostics: string[];
  extra_in_contributions: string[];
  extra_in_diagnostics: string[];
}

export interface ModelValidationResult {
  model_id: string;
  is_complete: boolean;
  channel_alignment: ChannelAlignmentResult;
  array_length_check: {
    contributions_match: boolean;
    diagnostics_match: boolean;
    expected_length: number;
    contributions_length: number;
    diagnostics_length: number;
  };
  errors: string[];
}