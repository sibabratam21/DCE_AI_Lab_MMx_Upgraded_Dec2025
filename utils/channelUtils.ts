/**
 * Strict channel equality utilities for global use
 */

import { ModelRun } from '../types';

/**
 * Check if two sets are exactly equal (same size and elements)
 */
export const eqSet = <T>(a: Set<T>, b: Set<T>): boolean => {
  return a.size === b.size && [...a].every(x => b.has(x));
};

/**
 * Check if a model's channels match the selected channels exactly
 */
export const channelsMatch = (model: ModelRun | undefined | null, selectedChannels: string[]): boolean => {
  if (!model?.channels) return false;
  return eqSet(new Set(model.channels), new Set(selectedChannels));
};

/**
 * Filter models by exact channel match
 */
export const filterModelsByChannels = (models: ModelRun[], selectedChannels: string[]): ModelRun[] => {
  return models.filter(m => channelsMatch(m, selectedChannels));
};

/**
 * Check if model is stale based on provenance
 */
export const isModelStale = (
  model: ModelRun,
  currentFeaturesHash: string,
  currentRangesHash: string
): boolean => {
  if (!model.provenance) return true; // No provenance = stale
  return (
    model.provenance.features_hash !== currentFeaturesHash ||
    model.provenance.ranges_hash !== currentRangesHash
  );
};

/**
 * Generate hash for channel set (for provenance tracking)
 */
export const generateChannelHash = (channels: string[]): string => {
  return JSON.stringify(channels.sort()).slice(0, 8);
};

/**
 * Generate hash for feature parameters (for provenance tracking)
 */
export const generateFeatureHash = (features: any[]): string => {
  const sorted = features
    .map(f => ({
      channel: f.channel,
      adstock: f.adstock,
      lag: f.lag,
      transform: f.transform
    }))
    .sort((a, b) => a.channel.localeCompare(b.channel));
  return JSON.stringify(sorted).slice(0, 8);
};