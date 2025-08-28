/**
 * Report view selectors for strict model consistency and data integrity
 */

import { ModelRun } from '../types';
import { eqSet, ModelById, ContributionsById, DiagnosticsById } from './modelSelectors';
import { getConsistentChannelSpend } from './demoSimulation';

// Extended data structures for report view
export interface ResponseCurveData {
  modelId: string;
  channels: string[];
  curves: {
    channel: string;
    points: Array<{ spend: number; response: number }>;
    params: {
      adstock: number;
      lag: number;
      transform: string;
    };
    operatingPoint: {
      spend: number;
      response: number;
      elasticity: number;
      mROI: number;
    };
  }[];
}

export interface ResponseCurvesById {
  [id: string]: ResponseCurveData;
}

export interface ReportMetrics {
  modelId: string;
  totalSpend: number;
  totalImpact: number;
  baseImpact: number;
  marketingImpact: number;
  blendedROI: number;
}

export interface MetricsById {
  [id: string]: ReportMetrics;
}

export interface ReportView {
  model: ModelRun | null;
  metrics: ReportMetrics | null;
  attribution: ContributionsById[string] | null;
  curves: ResponseCurveData | null;
  diagnostics: DiagnosticsById[string] | null;
  consistent: boolean;
  inconsistencyReason?: string;
}

/**
 * Calculate operating point for a channel
 * Uses last-13-week average, fallback to last-52-week if insufficient data
 */
const calculateOperatingPoint = (channelName: string, avgActivity?: number): number => {
  // Get 13-week average spend (operating point)
  const operatingSpend = getConsistentChannelSpend(channelName, avgActivity) / 1000000; // Convert to M
  return operatingSpend;
};

/**
 * Generate response curve with operating point
 */
const generateResponseCurveWithOperating = (
  channel: ModelRun['details'][0], 
  totalImpact: number
): ResponseCurveData['curves'][0] => {
  const spendLevels = Array.from({ length: 51 }, (_, i) => i * 4); // 0 to 200
  const maxResponse = (channel.contribution / 100 * totalImpact) * 1.5;
  let responseValues: number[];

  // Apply transformation based on channel parameters
  switch (channel.transform) {
    case 'S-Curve': {
      const steepness = 5;
      const midpoint = 80;
      responseValues = spendLevels.map(spend => 
        maxResponse / (1 + Math.exp(-steepness * (spend - midpoint) / 100))
      );
      break;
    }
    case 'Power': {
      const exponent = 1 - channel.adstock * 0.8;
      const scale = maxResponse / Math.pow(200, exponent);
      responseValues = spendLevels.map(spend => 
        scale * Math.pow(spend, exponent)
      );
      break;
    }
    case 'Log-transform': {
      const scale = maxResponse / Math.log(201);
      responseValues = spendLevels.map(spend => 
        scale * Math.log(spend + 1)
      );
      break;
    }
    case 'Negative Exponential':
    default: {
      const steepness = (1.1 - channel.adstock) * 3;
      responseValues = spendLevels.map(spend => 
        maxResponse * (1 - Math.exp(-steepness * spend / 100))
      );
      break;
    }
  }

  const points = spendLevels.map((spend, i) => ({
    spend,
    response: responseValues[i] || 0
  }));

  // Calculate operating point
  const operatingSpend = calculateOperatingPoint(channel.name);
  
  // Find response at operating point using interpolation
  let operatingResponse = 0;
  let operatingIndex = 0;
  
  for (let i = 0; i < spendLevels.length - 1; i++) {
    if (operatingSpend >= spendLevels[i] && operatingSpend <= spendLevels[i + 1]) {
      operatingIndex = i;
      const t = (operatingSpend - spendLevels[i]) / (spendLevels[i + 1] - spendLevels[i]);
      operatingResponse = responseValues[i] + t * (responseValues[i + 1] - responseValues[i]);
      break;
    }
  }

  // If operating spend is beyond our range, extrapolate
  if (operatingSpend > spendLevels[spendLevels.length - 1]) {
    operatingResponse = responseValues[responseValues.length - 1];
  }

  // Calculate elasticity: ε(x) = (dy/dx) * x/y
  const deltaSpend = 0.01; // Small change for finite difference
  const deltaResponse = calculateResponseDelta(channel, operatingSpend, deltaSpend, maxResponse);
  const elasticity = operatingResponse > 0 
    ? (deltaResponse / deltaSpend) * (operatingSpend / operatingResponse)
    : 0;

  // Calculate marginal ROI: mROI ≈ Δy/Δx
  const mROI = deltaResponse / deltaSpend;

  return {
    channel: channel.name,
    points,
    params: {
      adstock: channel.adstock,
      lag: channel.lag,
      transform: channel.transform
    },
    operatingPoint: {
      spend: operatingSpend,
      response: operatingResponse,
      elasticity,
      mROI
    }
  };
};

/**
 * Calculate response delta for finite difference (elasticity and mROI)
 */
const calculateResponseDelta = (
  channel: ModelRun['details'][0],
  baseSpend: number,
  deltaSpend: number,
  maxResponse: number
): number => {
  const newSpend = baseSpend + deltaSpend;
  let baseResponse: number, newResponse: number;

  switch (channel.transform) {
    case 'S-Curve': {
      const steepness = 5;
      const midpoint = 80;
      baseResponse = maxResponse / (1 + Math.exp(-steepness * (baseSpend - midpoint) / 100));
      newResponse = maxResponse / (1 + Math.exp(-steepness * (newSpend - midpoint) / 100));
      break;
    }
    case 'Power': {
      const exponent = 1 - channel.adstock * 0.8;
      const scale = maxResponse / Math.pow(200, exponent);
      baseResponse = scale * Math.pow(baseSpend, exponent);
      newResponse = scale * Math.pow(newSpend, exponent);
      break;
    }
    case 'Log-transform': {
      const scale = maxResponse / Math.log(201);
      baseResponse = scale * Math.log(baseSpend + 1);
      newResponse = scale * Math.log(newSpend + 1);
      break;
    }
    case 'Negative Exponential':
    default: {
      const steepness = (1.1 - channel.adstock) * 3;
      baseResponse = maxResponse * (1 - Math.exp(-steepness * baseSpend / 100));
      newResponse = maxResponse * (1 - Math.exp(-steepness * newSpend / 100));
      break;
    }
  }

  return newResponse - baseResponse;
};

/**
 * Create report data stores from models
 */
export const createReportDataStores = (models: ModelRun[]): {
  modelById: ModelById;
  contributionsById: ContributionsById;
  diagnosticsById: DiagnosticsById;
  responseCurvesById: ResponseCurvesById;
  metricsById: MetricsById;
} => {
  const modelById: ModelById = {};
  const contributionsById: ContributionsById = {};
  const diagnosticsById: DiagnosticsById = {};
  const responseCurvesById: ResponseCurvesById = {};
  const metricsById: MetricsById = {};

  models.forEach(model => {
    // Store model
    modelById[model.id] = model;

    // Extract channels
    const channels = model.channels || model.details.map(d => d.name);
    const includedChannels = model.details.filter(d => d.included);

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

    // Calculate metrics
    const totalSpend = includedChannels.reduce((sum, p) => {
      return sum + getConsistentChannelSpend(p.name) / 1000000; // Convert to M
    }, 0);
    
    const totalImpact = 100000; // Total KPI impact
    const basePercentage = 25; // Base sales represent 25%
    const baseImpact = (basePercentage / 100) * totalImpact;
    const marketingImpact = totalImpact - baseImpact;

    metricsById[model.id] = {
      modelId: model.id,
      totalSpend,
      totalImpact,
      baseImpact,
      marketingImpact,
      blendedROI: model.roi
    };

    // Create response curves with operating points
    responseCurvesById[model.id] = {
      modelId: model.id,
      channels,
      curves: includedChannels.map(channel => 
        generateResponseCurveWithOperating(channel, marketingImpact)
      )
    };
  });

  return { modelById, contributionsById, diagnosticsById, responseCurvesById, metricsById };
};

/**
 * Selector for report view with strict model consistency
 * Contract: activeModel.channels === selectedChannels (strict equality)
 */
export const selectReportView = (
  activeModelId: string | null,
  selectedChannels: string[],
  modelById: ModelById,
  contributionsById: ContributionsById,
  diagnosticsById: DiagnosticsById,
  responseCurvesById: ResponseCurvesById,
  metricsById: MetricsById
): ReportView => {
  // No active model selected
  if (!activeModelId) {
    return {
      model: null,
      metrics: null,
      attribution: null,
      curves: null,
      diagnostics: null,
      consistent: false,
      inconsistencyReason: 'No model selected'
    };
  }

  // Get all data sources
  const model = modelById[activeModelId] || null;
  const metrics = metricsById[activeModelId] || null;
  const attribution = contributionsById[activeModelId] || null;
  const curves = responseCurvesById[activeModelId] || null;
  const diagnostics = diagnosticsById[activeModelId] || null;

  // Check if all data exists
  if (!model || !metrics || !attribution || !curves || !diagnostics) {
    const missing = [];
    if (!model) missing.push('model');
    if (!metrics) missing.push('metrics');
    if (!attribution) missing.push('attribution');
    if (!curves) missing.push('curves');
    if (!diagnostics) missing.push('diagnostics');
    
    return {
      model,
      metrics,
      attribution,
      curves,
      diagnostics,
      consistent: false,
      inconsistencyReason: `Missing data: ${missing.join(', ')}`
    };
  }

  // STRICT channel equality check: set(activeModel.channels) === set(selectedChannels)
  const modelChannels = new Set(model.channels || []);
  const selectedChannelsSet = new Set(selectedChannels);

  const channelsMatch = eqSet(modelChannels, selectedChannelsSet);

  if (!channelsMatch) {
    const reason = `Channel mismatch - Model: [${Array.from(modelChannels).join(', ')}], ` +
                   `Selected: [${Array.from(selectedChannelsSet).join(', ')}]`;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ReportSelector] ${reason}`);
    }
    
    return {
      model,
      metrics,
      attribution,
      curves,
      diagnostics,
      consistent: false,
      inconsistencyReason: reason
    };
  }

  // Additional consistency checks across data blocks
  const allChannelsMatch = 
    eqSet(modelChannels, new Set(attribution.channels)) &&
    eqSet(modelChannels, new Set(diagnostics.channels)) &&
    eqSet(modelChannels, new Set(curves.channels));

  if (!allChannelsMatch) {
    return {
      model,
      metrics,
      attribution,
      curves,
      diagnostics,
      consistent: false,
      inconsistencyReason: 'Data consistency error: channel arrays do not match across blocks'
    };
  }

  // All checks passed - data is consistent
  return {
    model,
    metrics,
    attribution,
    curves,
    diagnostics,
    consistent: true
  };
};