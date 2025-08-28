import { ModelRun } from '../types';

// Utility to check if two sets are equal
export const eqSet = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

// Model storage interfaces
export interface ModelById {
  [id: string]: ModelRun;
}

export interface ContributionData {
  modelId: string;
  channels: string[];
  contributions: {
    channel: string;
    value: number;
    percentage: number;
  }[];
}

export interface DiagnosticData {
  modelId: string;
  channels: string[];
  diagnostics: {
    channel: string;
    pValue?: number | null;
    coefficient?: number;
    stderr?: number;
    confidence_interval?: [number, number];
    sign?: 'positive' | 'negative' | 'neutral';
    importance?: number;
  }[];
}

export interface ContributionsById {
  [id: string]: ContributionData;
}

export interface DiagnosticsById {
  [id: string]: DiagnosticData;
}

export interface ActiveModelView {
  model: ModelRun | null;
  contrib: ContributionData | null;
  diag: DiagnosticData | null;
  consistent: boolean;
  inconsistencyReason?: string;
}

/**
 * Selector for active model view with consistency checking
 * Ensures model, contributions, and diagnostics are all aligned on the same channels
 */
export const selectActiveModelView = (
  activeModelId: string | null,
  modelById: ModelById,
  contributionsById: ContributionsById,
  diagnosticsById: DiagnosticsById
): ActiveModelView => {
  // No active model selected
  if (!activeModelId) {
    return {
      model: null,
      contrib: null,
      diag: null,
      consistent: false,
      inconsistencyReason: 'No model selected'
    };
  }

  // Get the three data sources
  const model = modelById[activeModelId] || null;
  const contrib = contributionsById[activeModelId] || null;
  const diag = diagnosticsById[activeModelId] || null;

  // Check if all three exist
  if (!model || !contrib || !diag) {
    const missing = [];
    if (!model) missing.push('model');
    if (!contrib) missing.push('contributions');
    if (!diag) missing.push('diagnostics');
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ModelSelector] Missing data for model ${activeModelId}: ${missing.join(', ')}`);
    }
    
    return {
      model,
      contrib,
      diag,
      consistent: false,
      inconsistencyReason: `Missing data: ${missing.join(', ')}`
    };
  }

  // Check channel consistency
  const modelChannels = new Set(model.channels || []);
  const contribChannels = new Set(contrib.channels);
  const diagChannels = new Set(diag.channels);

  const channelsMatch = 
    eqSet(modelChannels, contribChannels) && 
    eqSet(modelChannels, diagChannels);

  if (!channelsMatch) {
    const reason = `Channel mismatch - Model: [${Array.from(modelChannels).join(', ')}], ` +
                   `Contributions: [${Array.from(contribChannels).join(', ')}], ` +
                   `Diagnostics: [${Array.from(diagChannels).join(', ')}]`;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ModelSelector] ${reason}`);
    }
    
    return {
      model,
      contrib,
      diag,
      consistent: false,
      inconsistencyReason: reason
    };
  }

  // All checks passed - data is consistent
  return {
    model,
    contrib,
    diag,
    consistent: true
  };
};

// Helper function to create mock data stores from ModelRun array
export const createModelDataStores = (models: ModelRun[]): {
  modelById: ModelById;
  contributionsById: ContributionsById;
  diagnosticsById: DiagnosticsById;
} => {
  const modelById: ModelById = {};
  const contributionsById: ContributionsById = {};
  const diagnosticsById: DiagnosticsById = {};

  models.forEach(model => {
    // Store model
    modelById[model.id] = model;

    // Extract channels from model
    const channels = model.channels || model.details.map(d => d.name);

    // Create contributions data
    contributionsById[model.id] = {
      modelId: model.id,
      channels,
      contributions: model.details.map(detail => ({
        channel: detail.name,
        value: detail.contribution,
        percentage: detail.contribution
      }))
    };

    // Create diagnostics data
    diagnosticsById[model.id] = {
      modelId: model.id,
      channels,
      diagnostics: model.details.map(detail => ({
        channel: detail.name,
        pValue: detail.pValue,
        coefficient: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.coefficient,
        stderr: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.stderr,
        confidence_interval: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.confidence_interval,
        sign: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.actual_sign,
        importance: model.diagnostics?.channel_diagnostics?.find(d => d.name === detail.name)?.importance
      }))
    };
  });

  return { modelById, contributionsById, diagnosticsById };
};