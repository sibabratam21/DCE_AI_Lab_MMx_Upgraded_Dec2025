import { 
  eqSet, 
  channelsMatch, 
  filterModelsByChannels,
  isModelStale,
  generateChannelHash,
  generateFeatureHash
} from './channelUtils';
import { ModelRun } from '../types';

describe('Channel Utilities', () => {
  describe('eqSet', () => {
    it('should return true for equal sets', () => {
      const a = new Set(['TV', 'Radio', 'Digital']);
      const b = new Set(['Radio', 'TV', 'Digital']);
      expect(eqSet(a, b)).toBe(true);
    });

    it('should return false for different sizes', () => {
      const a = new Set(['TV', 'Radio']);
      const b = new Set(['TV', 'Radio', 'Digital']);
      expect(eqSet(a, b)).toBe(false);
    });

    it('should return false for different elements', () => {
      const a = new Set(['TV', 'Radio', 'Digital']);
      const b = new Set(['TV', 'Radio', 'Print']);
      expect(eqSet(a, b)).toBe(false);
    });
  });

  describe('channelsMatch', () => {
    const mockModel: ModelRun = {
      id: 'test_model',
      algo: 'Bayesian Regression',
      rsq: 0.85,
      mape: 12.5,
      roi: 2.3,
      commentary: '',
      channels: ['TV', 'Radio', 'Digital'],
      details: [],
      provenance: {
        features_hash: 'hash123',
        ranges_hash: 'hash456',
        algo: 'Bayesian',
        data_version: 'v1',
        timestamp: Date.now()
      },
      diagnostics: {
        weak_channels: [],
        sign_mismatch: [],
        overfit_risk: false,
        warning_count: 0,
        channel_diagnostics: []
      }
    };

    it('should return true for matching channels', () => {
      const selectedChannels = ['TV', 'Radio', 'Digital'];
      expect(channelsMatch(mockModel, selectedChannels)).toBe(true);
    });

    it('should return true even if order is different', () => {
      const selectedChannels = ['Digital', 'TV', 'Radio'];
      expect(channelsMatch(mockModel, selectedChannels)).toBe(true);
    });

    it('should return false for different channels', () => {
      const selectedChannels = ['TV', 'Radio', 'Print'];
      expect(channelsMatch(mockModel, selectedChannels)).toBe(false);
    });

    it('should return false for missing channels', () => {
      const selectedChannels = ['TV', 'Radio'];
      expect(channelsMatch(mockModel, selectedChannels)).toBe(false);
    });

    it('should return false for extra channels', () => {
      const selectedChannels = ['TV', 'Radio', 'Digital', 'Print'];
      expect(channelsMatch(mockModel, selectedChannels)).toBe(false);
    });

    it('should return false for undefined model', () => {
      expect(channelsMatch(undefined, ['TV'])).toBe(false);
    });

    it('should return false for model without channels', () => {
      const modelNoChannels = { ...mockModel, channels: undefined };
      expect(channelsMatch(modelNoChannels as any, ['TV'])).toBe(false);
    });
  });

  describe('filterModelsByChannels', () => {
    const models: ModelRun[] = [
      {
        id: 'model_1',
        algo: 'Bayesian Regression',
        rsq: 0.85,
        mape: 12.5,
        roi: 2.3,
        commentary: '',
        channels: ['TV', 'Radio', 'Digital'],
        details: [],
        provenance: {
          features_hash: 'hash1',
          ranges_hash: 'hash2',
          algo: 'Bayesian',
          data_version: 'v1',
          timestamp: Date.now()
        },
        diagnostics: {
          weak_channels: [],
          sign_mismatch: [],
          overfit_risk: false,
          warning_count: 0,
          channel_diagnostics: []
        }
      },
      {
        id: 'model_2',
        algo: 'GLM Regression',
        rsq: 0.75,
        mape: 15.0,
        roi: 1.8,
        commentary: '',
        channels: ['TV', 'Radio', 'Print'], // Different!
        details: [],
        provenance: {
          features_hash: 'hash3',
          ranges_hash: 'hash4',
          algo: 'GLM',
          data_version: 'v1',
          timestamp: Date.now()
        },
        diagnostics: {
          weak_channels: [],
          sign_mismatch: [],
          overfit_risk: false,
          warning_count: 0,
          channel_diagnostics: []
        }
      },
      {
        id: 'model_3',
        algo: 'NN',
        rsq: 0.80,
        mape: 13.0,
        roi: 2.0,
        commentary: '',
        channels: ['TV', 'Radio', 'Digital'], // Matches!
        details: [],
        provenance: {
          features_hash: 'hash5',
          ranges_hash: 'hash6',
          algo: 'NN',
          data_version: 'v1',
          timestamp: Date.now()
        },
        diagnostics: {
          weak_channels: [],
          sign_mismatch: [],
          overfit_risk: false,
          warning_count: 0,
          channel_diagnostics: []
        }
      }
    ];

    it('should filter models with exact channel match', () => {
      const selectedChannels = ['TV', 'Radio', 'Digital'];
      const filtered = filterModelsByChannels(models, selectedChannels);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('model_1');
      expect(filtered[1].id).toBe('model_3');
    });

    it('should exclude models with different channels', () => {
      const selectedChannels = ['TV', 'Radio', 'Print'];
      const filtered = filterModelsByChannels(models, selectedChannels);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('model_2');
    });

    it('should return empty array when no models match', () => {
      const selectedChannels = ['Social', 'Email'];
      const filtered = filterModelsByChannels(models, selectedChannels);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('isModelStale', () => {
    const mockModel: ModelRun = {
      id: 'test',
      algo: 'Bayesian Regression',
      rsq: 0.85,
      mape: 12.5,
      roi: 2.3,
      commentary: '',
      channels: ['TV'],
      details: [],
      provenance: {
        features_hash: 'hash123',
        ranges_hash: 'hash456',
        algo: 'Bayesian',
        data_version: 'v1',
        timestamp: Date.now()
      },
      diagnostics: {
        weak_channels: [],
        sign_mismatch: [],
        overfit_risk: false,
        warning_count: 0,
        channel_diagnostics: []
      }
    };

    it('should return false when hashes match', () => {
      expect(isModelStale(mockModel, 'hash123', 'hash456')).toBe(false);
    });

    it('should return true when features hash differs', () => {
      expect(isModelStale(mockModel, 'different', 'hash456')).toBe(true);
    });

    it('should return true when ranges hash differs', () => {
      expect(isModelStale(mockModel, 'hash123', 'different')).toBe(true);
    });

    it('should return true when both hashes differ', () => {
      expect(isModelStale(mockModel, 'different1', 'different2')).toBe(true);
    });

    it('should return true when model has no provenance', () => {
      const modelNoProvenance = { ...mockModel, provenance: undefined };
      expect(isModelStale(modelNoProvenance as any, 'hash123', 'hash456')).toBe(true);
    });
  });

  describe('generateChannelHash', () => {
    it('should generate consistent hash for same channels', () => {
      const channels1 = ['TV', 'Radio', 'Digital'];
      const channels2 = ['TV', 'Radio', 'Digital'];
      expect(generateChannelHash(channels1)).toBe(generateChannelHash(channels2));
    });

    it('should generate same hash regardless of order', () => {
      const channels1 = ['TV', 'Radio', 'Digital'];
      const channels2 = ['Digital', 'TV', 'Radio'];
      expect(generateChannelHash(channels1)).toBe(generateChannelHash(channels2));
    });

    it('should generate different hash for different channels', () => {
      const channels1 = ['TV', 'Radio', 'Digital'];
      const channels2 = ['TV', 'Radio', 'Print'];
      expect(generateChannelHash(channels1)).not.toBe(generateChannelHash(channels2));
    });
  });
});