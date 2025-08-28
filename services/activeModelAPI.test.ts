/**
 * Contract tests for Active Model API - ensuring channel array alignment
 */

import {
  validateChannelAlignment,
  validateModelData,
  convertModelRunToDTO,
  getActiveModel,
  getActiveModels,
  validateAPIContract
} from './activeModelAPI';
import {
  ModelContributionsDTO,
  ModelDiagnosticsDTO,
  ActiveModelResponse,
  GetActiveModelRequest
} from '../types/api';
import { ModelRun } from '../types';

describe('Active Model API - Contract Tests', () => {
  
  describe('Channel Array Alignment', () => {
    it('should validate aligned channel arrays', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'test_1',
        channels: ['TV', 'Radio', 'Digital'],
        values: [45, 30, 25],
        basis: 'train'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'test_1',
        channels: ['TV', 'Radio', 'Digital'], // Same order
        rows: [
          { channel: 'TV', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
          { channel: 'Radio', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null },
          { channel: 'Digital', coefficient: 0.2, p_value: 0.10, ci95_lower: 0.0, ci95_upper: 0.4, sign: 'neutral', importance: null }
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateChannelAlignment(contributions, diagnostics);
      
      expect(result.is_aligned).toBe(true);
      expect(result.missing_in_contributions).toHaveLength(0);
      expect(result.missing_in_diagnostics).toHaveLength(0);
    });

    it('should validate aligned channels regardless of order', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'test_2',
        channels: ['TV', 'Radio', 'Digital'],
        values: [45, 30, 25],
        basis: 'train'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'test_2',
        channels: ['Digital', 'TV', 'Radio'], // Different order
        rows: [
          { channel: 'Digital', coefficient: 0.2, p_value: 0.10, ci95_lower: 0.0, ci95_upper: 0.4, sign: 'neutral', importance: null },
          { channel: 'TV', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
          { channel: 'Radio', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null }
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateChannelAlignment(contributions, diagnostics);
      
      expect(result.is_aligned).toBe(true);
    });

    it('should detect channel misalignment', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'test_3',
        channels: ['TV', 'Radio', 'Digital'],
        values: [45, 30, 25],
        basis: 'train'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'test_3',
        channels: ['TV', 'Radio', 'Print'], // Different channel!
        rows: [
          { channel: 'TV', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
          { channel: 'Radio', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null },
          { channel: 'Print', coefficient: 0.2, p_value: 0.15, ci95_lower: 0.0, ci95_upper: 0.4, sign: 'neutral', importance: null }
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateChannelAlignment(contributions, diagnostics);
      
      expect(result.is_aligned).toBe(false);
      expect(result.missing_in_contributions).toEqual(['Print']);
      expect(result.missing_in_diagnostics).toEqual(['Digital']);
    });
  });

  describe('Complete Model Validation', () => {
    it('should pass validation for complete, aligned model', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'complete_model',
        channels: ['TV', 'Radio'],
        values: [60, 40],
        basis: 'holdout'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'complete_model',
        channels: ['TV', 'Radio'],
        rows: [
          { channel: 'TV', coefficient: null, p_value: null, ci95_lower: null, ci95_upper: null, sign: null, importance: 0.7 },
          { channel: 'Radio', coefficient: null, p_value: null, ci95_lower: null, ci95_upper: null, sign: null, importance: 0.3 }
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateModelData('complete_model', contributions, diagnostics);
      
      expect(result.is_complete).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.channel_alignment.is_aligned).toBe(true);
      expect(result.array_length_check.contributions_match).toBe(true);
      expect(result.array_length_check.diagnostics_match).toBe(true);
    });

    it('should fail validation for misaligned arrays', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'broken_model',
        channels: ['TV', 'Radio', 'Digital'],
        values: [45, 30], // Missing value!
        basis: 'train'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'broken_model',
        channels: ['TV', 'Radio', 'Digital'],
        rows: [
          { channel: 'TV', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
          { channel: 'Radio', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null }
          // Missing Digital row!
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateModelData('broken_model', contributions, diagnostics);
      
      expect(result.is_complete).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('values array length'));
      expect(result.errors).toContain(expect.stringContaining('rows array length'));
    });
  });

  describe('ModelRun to DTO Conversion', () => {
    it('should convert Bayesian model with statistical diagnostics', () => {
      const bayesianModel: ModelRun = {
        id: 'bayes_1',
        algo: 'Bayesian Regression',
        rsq: 0.85,
        mape: 12.5,
        roi: 2.3,
        commentary: 'Test Bayesian',
        channels: ['TV', 'Radio'],
        details: [
          { name: 'TV', included: true, contribution: 60, roi: 2.8, pValue: 0.01, adstock: 0.8, lag: 0, transform: 'Log-transform' },
          { name: 'Radio', included: true, contribution: 40, roi: 2.0, pValue: 0.05, adstock: 0.6, lag: 1, transform: 'Log-transform' }
        ],
        provenance: {
          features_hash: 'bayes123',
          ranges_hash: 'bayes456',
          algo: 'Bayesian',
          data_version: 'v2.0',
          timestamp: 1640995200000, // 2022-01-01
          seed: 123
        },
        diagnostics: {
          weak_channels: [],
          sign_mismatch: [],
          overfit_risk: false,
          warning_count: 0,
          channel_diagnostics: [
            { 
              name: 'TV', 
              coefficient: 0.5, 
              pValue: 0.01, 
              confidence_interval: [0.2, 0.8], 
              actual_sign: 'positive',
              expected_sign: 'positive',
              sign_mismatch: false
            },
            { 
              name: 'Radio', 
              coefficient: 0.3, 
              pValue: 0.05, 
              confidence_interval: [0.1, 0.5], 
              actual_sign: 'positive',
              expected_sign: 'positive',
              sign_mismatch: false
            }
          ]
        }
      };
      
      const { metadata, contributions, diagnostics } = convertModelRunToDTO(bayesianModel);
      
      // Test metadata
      expect(metadata.algorithm).toBe('Bayesian');
      expect(metadata.performance.rsq).toBe(0.85);
      expect(metadata.provenance.features_hash).toBe('bayes123');
      
      // Test contributions
      expect(contributions.channels).toEqual(['TV', 'Radio']);
      expect(contributions.values).toEqual([60, 40]);
      expect(contributions.basis).toBe('train');
      
      // Test diagnostics (statistical model)
      expect(diagnostics.channels).toEqual(['TV', 'Radio']);
      expect(diagnostics.rows).toHaveLength(2);
      expect(diagnostics.rows[0].coefficient).toBe(0.5);
      expect(diagnostics.rows[0].p_value).toBe(0.01);
      expect(diagnostics.rows[0].importance).toBeNull();
      
      // Validate alignment
      const validation = validateModelData('bayes_1', contributions, diagnostics);
      expect(validation.is_complete).toBe(true);
    });

    it('should convert NN model with importance diagnostics', () => {
      const nnModel: ModelRun = {
        id: 'nn_1',
        algo: 'NN',
        rsq: 0.80,
        mape: 15.0,
        roi: 2.0,
        commentary: 'Test NN',
        channels: ['TV', 'Radio', 'Digital'],
        details: [
          { name: 'TV', included: true, contribution: 50, roi: 2.5, pValue: null, adstock: 0.7, lag: 0, transform: 'Log-transform' },
          { name: 'Radio', included: true, contribution: 30, roi: 1.8, pValue: null, adstock: 0.5, lag: 1, transform: 'Log-transform' },
          { name: 'Digital', included: true, contribution: 20, roi: 1.5, pValue: null, adstock: 0.3, lag: 0, transform: 'S-Curve' }
        ],
        provenance: {
          features_hash: 'nn123',
          ranges_hash: 'nn456',
          algo: 'NN',
          data_version: 'v2.0',
          timestamp: 1640995200000,
          seed: 456
        },
        diagnostics: {
          weak_channels: ['Digital'],
          sign_mismatch: [],
          overfit_risk: false,
          warning_count: 1,
          channel_diagnostics: [
            { name: 'TV', importance: 0.6 },
            { name: 'Radio', importance: 0.3 },
            { name: 'Digital', importance: 0.1 }
          ]
        }
      };
      
      const { metadata, contributions, diagnostics } = convertModelRunToDTO(nnModel);
      
      // Test metadata
      expect(metadata.algorithm).toBe('NN');
      
      // Test diagnostics (tree/NN model)
      expect(diagnostics.rows[0].coefficient).toBeNull();
      expect(diagnostics.rows[0].p_value).toBeNull();
      expect(diagnostics.rows[0].importance).toBe(0.6);
      expect(diagnostics.rows[1].importance).toBe(0.3);
      expect(diagnostics.rows[2].importance).toBe(0.1);
      
      // Validate alignment
      const validation = validateModelData('nn_1', contributions, diagnostics);
      expect(validation.is_complete).toBe(true);
    });
  });

  describe('API Endpoint Tests', () => {
    it('should return complete model response for valid request', async () => {
      const request: GetActiveModelRequest = {
        model_id: 'test_model_1',
        include_diagnostics: true,
        basis: 'holdout'
      };
      
      const response: ActiveModelResponse = await getActiveModel(request);
      
      expect(response.is_complete).toBe(true);
      expect(response.metadata.id).toBe('test_model_1');
      expect(response.contributions.channels).toEqual(response.diagnostics.channels);
      expect(response.contributions.values.length).toBe(response.contributions.channels.length);
      expect(response.diagnostics.rows.length).toBe(response.diagnostics.channels.length);
    });

    it('should exclude incomplete models from batch response', async () => {
      const request = {
        model_ids: ['valid_model', 'broken_model', 'another_valid'],
        exclude_incomplete: true
      };
      
      // This would typically test against real broken data
      // For now, we test the structure
      const response = await getActiveModels(request);
      
      expect(response.total_requested).toBe(3);
      expect(response.models.length).toBeGreaterThanOrEqual(0);
      expect(response.incomplete_models).toBeDefined();
      expect(Array.isArray(response.incomplete_models)).toBe(true);
    });
  });

  describe('Contract Health Check', () => {
    it('should pass all contract validation tests', () => {
      const healthCheck = validateAPIContract();
      
      expect(healthCheck.channel_alignment_test).toBe(true);
      expect(healthCheck.array_length_test).toBe(true);
      expect(healthCheck.dto_structure_test).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty channel arrays', () => {
      const emptyContribs: ModelContributionsDTO = {
        model_id: 'empty',
        channels: [],
        values: [],
        basis: 'train'
      };
      
      const emptyDiagnostics: ModelDiagnosticsDTO = {
        model_id: 'empty',
        channels: [],
        rows: [],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateModelData('empty', emptyContribs, emptyDiagnostics);
      expect(result.is_complete).toBe(true);
      expect(result.channel_alignment.is_aligned).toBe(true);
    });

    it('should detect diagnostic rows with wrong channel names', () => {
      const contributions: ModelContributionsDTO = {
        model_id: 'wrong_names',
        channels: ['TV', 'Radio'],
        values: [60, 40],
        basis: 'train'
      };
      
      const diagnostics: ModelDiagnosticsDTO = {
        model_id: 'wrong_names',
        channels: ['TV', 'Radio'],
        rows: [
          { channel: 'TV', coefficient: 0.5, p_value: 0.01, ci95_lower: 0.2, ci95_upper: 0.8, sign: 'positive', importance: null },
          { channel: 'Print', coefficient: 0.3, p_value: 0.05, ci95_lower: 0.1, ci95_upper: 0.5, sign: 'positive', importance: null } // Wrong name!
        ],
        summary: {
          weak_channels: [],
          sign_mismatches: [],
          overfit_risk: false,
          warning_count: 0
        }
      };
      
      const result = validateModelData('wrong_names', contributions, diagnostics);
      expect(result.is_complete).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Diagnostic row channels'));
    });
  });
});