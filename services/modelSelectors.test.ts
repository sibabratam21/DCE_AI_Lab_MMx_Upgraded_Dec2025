import { 
  eqSet, 
  selectActiveModelView, 
  ModelById, 
  ContributionsById, 
  DiagnosticsById 
} from './modelSelectors';
import { ModelRun } from '../types';

// Test suite for eqSet utility
describe('eqSet', () => {
  it('should return true for equal sets', () => {
    const a = new Set(['TV', 'Radio', 'Digital']);
    const b = new Set(['Radio', 'TV', 'Digital']); // Different order
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

  it('should handle empty sets', () => {
    const a = new Set<string>();
    const b = new Set<string>();
    expect(eqSet(a, b)).toBe(true);
  });

  it('should handle numeric sets', () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([3, 2, 1]);
    expect(eqSet(a, b)).toBe(true);
  });
});

// Test suite for selectActiveModelView
describe('selectActiveModelView', () => {
  const mockModel: ModelRun = {
    id: 'model_1',
    algo: 'Bayesian Regression',
    rsq: 0.85,
    mape: 12.5,
    roi: 2.3,
    commentary: 'Test model',
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

  const mockContrib = {
    modelId: 'model_1',
    channels: ['TV', 'Radio', 'Digital'],
    contributions: [
      { channel: 'TV', value: 45, percentage: 45 },
      { channel: 'Radio', value: 30, percentage: 30 },
      { channel: 'Digital', value: 25, percentage: 25 }
    ]
  };

  const mockDiag = {
    modelId: 'model_1',
    channels: ['TV', 'Radio', 'Digital'],
    diagnostics: [
      { channel: 'TV', pValue: 0.01, coefficient: 0.5 },
      { channel: 'Radio', pValue: 0.05, coefficient: 0.3 },
      { channel: 'Digital', pValue: 0.08, coefficient: 0.2 }
    ]
  };

  it('should return consistent=true when all data matches', () => {
    const modelById: ModelById = { model_1: mockModel };
    const contributionsById: ContributionsById = { model_1: mockContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(true);
    expect(result.model).toBe(mockModel);
    expect(result.contrib).toBe(mockContrib);
    expect(result.diag).toBe(mockDiag);
    expect(result.inconsistencyReason).toBeUndefined();
  });

  it('should return consistent=false when model is missing', () => {
    const modelById: ModelById = {};
    const contributionsById: ContributionsById = { model_1: mockContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(false);
    expect(result.model).toBeNull();
    expect(result.inconsistencyReason).toContain('Missing data: model');
  });

  it('should return consistent=false when contributions are missing', () => {
    const modelById: ModelById = { model_1: mockModel };
    const contributionsById: ContributionsById = {};
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(false);
    expect(result.contrib).toBeNull();
    expect(result.inconsistencyReason).toContain('Missing data: contributions');
  });

  it('should return consistent=false when channels mismatch', () => {
    const mismatchedContrib = {
      ...mockContrib,
      channels: ['TV', 'Radio', 'Print'] // Different channel
    };

    const modelById: ModelById = { model_1: mockModel };
    const contributionsById: ContributionsById = { model_1: mismatchedContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(false);
    expect(result.inconsistencyReason).toContain('Channel mismatch');
  });

  it('should return consistent=false for null activeModelId', () => {
    const modelById: ModelById = { model_1: mockModel };
    const contributionsById: ContributionsById = { model_1: mockContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView(null, modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(false);
    expect(result.model).toBeNull();
    expect(result.contrib).toBeNull();
    expect(result.diag).toBeNull();
    expect(result.inconsistencyReason).toBe('No model selected');
  });

  it('should handle channel order differences correctly', () => {
    const reorderedContrib = {
      ...mockContrib,
      channels: ['Radio', 'Digital', 'TV'] // Same channels, different order
    };

    const modelById: ModelById = { model_1: mockModel };
    const contributionsById: ContributionsById = { model_1: reorderedContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    const result = selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(result.consistent).toBe(true); // Should be consistent despite order
  });

  it('should log warning in development mode when inconsistent', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const modelById: ModelById = {};
    const contributionsById: ContributionsById = { model_1: mockContrib };
    const diagnosticsById: DiagnosticsById = { model_1: mockDiag };

    selectActiveModelView('model_1', modelById, contributionsById, diagnosticsById);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ModelSelector] Missing data for model model_1')
    );

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});