import React, { useState, useMemo } from 'react';
import { ModelRun } from '../types';
import { eqSet, channelsMatch, isModelStale } from '../utils/channelUtils';

interface LeaderboardFilters {
  algos: string[];
  minR2: number;
  maxMAPE: number;
  minROI: number;
  showWarnings: boolean | null; // null = all, true = only warnings, false = no warnings
  showLegacy: boolean;
}

interface EnhancedModelLeaderboardProps {
  models: ModelRun[];
  selectedChannels: string[];
  activeModelId: string | null;
  selectedModelIds: string[];
  onSetActiveModel: (id: string | null) => void;
  onToggleModelSelection: (id: string) => void;
  onRecalibrate: () => void;
  isRecalibrating: boolean;
  currentFeaturesHash: string;
  currentRangesHash: string;
}

const DEFAULT_FILTERS: LeaderboardFilters = {
  algos: [],
  minR2: 0,
  maxMAPE: 50,     // Tighter default for quality models
  minROI: 0,       // Only positive ROI models
  showWarnings: null,
  showLegacy: false  // Legacy OFF by default for safety
};

export const EnhancedModelLeaderboard: React.FC<EnhancedModelLeaderboardProps> = ({
  models,
  selectedChannels,
  activeModelId,
  selectedModelIds,
  onSetActiveModel,
  onToggleModelSelection,
  onRecalibrate,
  isRecalibrating,
  currentFeaturesHash,
  currentRangesHash
}) => {
  const [filters, setFilters] = useState<LeaderboardFilters>(DEFAULT_FILTERS);
  const [showMore, setShowMore] = useState(false);
  
  const availableAlgos = useMemo(() => {
    return Array.from(new Set(models.map(m => m.algo)));
  }, [models]);

  // Filter and group models
  const { filteredModels, groupedModels, hasMatchingModels, hasStaleModels } = useMemo(() => {
    console.log('[EnhancedModelLeaderboard] Filtering models:', {
      totalModels: models.length,
      selectedChannels,
      filters,
      sampleModel: models[0],
      allModelIds: models.map(m => m.id),
      allModelChannels: models.map(m => ({ id: m.id, channels: m.channels }))
    });

    let filtered = models.filter((model, index) => {
      const filterReasons = [];
      
      // STRICT Channel matching - must have exact channel match
      const hasChannelMatch = channelsMatch(model, selectedChannels);
      if (!hasChannelMatch) {
        filterReasons.push(`Channel mismatch: ${JSON.stringify(model.channels)} vs ${JSON.stringify(selectedChannels)}`);
        if (!filters.showLegacy) {
          // Only exclude if legacy mode is OFF
          if (index < 3 || model.isNew) {
            console.log(`[EnhancedModelLeaderboard] Model ${model.id} filtered out due to channel mismatch:`, {
              modelChannels: model.channels,
              selectedChannels,
              isNew: model.isNew,
              isRecalibrated: (model as any).isRecalibrated
            });
          }
          return false;
        }
      }

      // Provenance check (stale models)
      if (currentFeaturesHash && currentRangesHash) {
        const stale = isModelStale(model, currentFeaturesHash, currentRangesHash);
        if (stale && !filters.showLegacy) {
          filterReasons.push('Stale model excluded (provenance mismatch)');
          return false;
        }
      }

      // Algorithm filter
      if (filters.algos.length > 0 && !filters.algos.includes(model.algo)) {
        filterReasons.push(`Algorithm ${model.algo} not in ${filters.algos}`);
        return false;
      }

      // Performance filters (with safety checks)
      if (model.rsq != null && model.rsq < filters.minR2) {
        filterReasons.push(`R² ${model.rsq} < ${filters.minR2}`);
        return false;
      }
      if (model.mape != null && model.mape > filters.maxMAPE) {
        filterReasons.push(`MAPE ${model.mape} > ${filters.maxMAPE}`);
        return false;
      }
      if (model.roi != null && model.roi < filters.minROI) {
        filterReasons.push(`ROI ${model.roi} < ${filters.minROI}`);
        return false;
      }

      // Warning filter (with safety checks for diagnostics)
      if (filters.showWarnings !== null && model.diagnostics) {
        const warningCount = model.diagnostics?.warning_count || 0;
        if (filters.showWarnings === true && warningCount === 0) {
          filterReasons.push('No warnings but warnings required');
          return false;
        }
        if (filters.showWarnings === false && warningCount > 0) {
          filterReasons.push('Has warnings but warnings excluded');
          return false;
        }
      }

      if (index < 3) { // Log first few models for debugging
        console.log(`Model ${model.id}: ${filterReasons.length > 0 ? 'FILTERED: ' + filterReasons.join(', ') : 'PASSED'}`);
      }
      
      return true;
    });

    // Group by algorithm
    const grouped = filtered.reduce((acc, model) => {
      if (!acc[model.algo]) acc[model.algo] = [];
      acc[model.algo].push(model);
      return acc;
    }, {} as Record<string, ModelRun[]>);

    // Sort within each group: ROI ↓, then R² ↓, then MAPE ↑
    Object.keys(grouped).forEach(algo => {
      grouped[algo].sort((a, b) => {
        if (Math.abs(a.roi - b.roi) > 0.01) return b.roi - a.roi;
        if (Math.abs(a.rsq - b.rsq) > 0.01) return b.rsq - a.rsq;
        return a.mape - b.mape;
      });
    });

    // Check for any stale or mismatched models
    const hasStale = models.some(m => {
      const channelMismatch = !channelsMatch(m, selectedChannels);
      const provenanceStale = currentFeaturesHash && currentRangesHash && 
                              isModelStale(m, currentFeaturesHash, currentRangesHash);
      return channelMismatch || provenanceStale;
    });

    console.log(`Filter result: ${filtered.length}/${models.length} models passed`);

    return {
      filteredModels: filtered,
      groupedModels: grouped,
      hasMatchingModels: filtered.length > 0,
      hasStaleModels: hasStale
    };
  }, [models, selectedChannels, filters, currentFeaturesHash, currentRangesHash]);

  // Display limit for "Show more" functionality
  const displayLimit = showMore ? Infinity : 20;
  const displayedModels = filteredModels.slice(0, displayLimit);

  const getBadges = (model: ModelRun) => {
    const badges = [];
    if (model.isNew) badges.push({ text: 'NEW', className: 'bg-green-100 text-green-700' });
    if (model.isPinned) badges.push({ text: 'PIN', className: 'bg-blue-100 text-blue-700' });
    if (model.diagnostics && model.diagnostics.warning_count > 0) {
      badges.push({ 
        text: `⚠️ ${model.diagnostics.warning_count}`, 
        className: 'bg-yellow-100 text-yellow-700' 
      });
    }
    return badges;
  };

  if (!hasMatchingModels && !hasStaleModels) {
    return (
      <div className="w-1/2 flex flex-col glass-pane p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Model Leaderboard</h2>
          <button
            onClick={onRecalibrate}
            disabled={isRecalibrating}
            className="px-4 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecalibrating ? 'Training...' : 'Start Training'}
          </button>
        </div>
        
        <div className="flex-grow flex items-center justify-center text-center p-8">
          <div>
            <div className="text-4xl mb-4">🔬</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No models match your current selection</h3>
            <p className="text-gray-600 text-sm mb-4">Train new models with your selected channels and parameter ranges.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-1/2 flex flex-col glass-pane p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Model Leaderboard ({filteredModels.length})</h2>
          {models.length > filteredModels.length && (
            <p className="text-xs text-gray-500">{models.length - filteredModels.length} models hidden by filters</p>
          )}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
          >
            Reset Filters
          </button>
          <button
            onClick={onRecalibrate}
            disabled={isRecalibrating}
            className="px-4 py-2 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecalibrating ? 'Training...' : 'Recalibrate'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4 text-sm">
          {/* Algorithm filter */}
          <div className="flex items-center space-x-2">
            <label className="font-medium text-gray-700">Algorithms:</label>
            <div className="flex flex-wrap gap-1">
              {availableAlgos.map(algo => (
                <label key={algo} className="flex items-center space-x-1">
                  <input 
                    type="checkbox"
                    checked={filters.algos.includes(algo)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters(prev => ({ ...prev, algos: [...prev.algos, algo] }));
                      } else {
                        setFilters(prev => ({ ...prev, algos: prev.algos.filter(a => a !== algo) }));
                      }
                    }}
                    className="rounded text-xs"
                  />
                  <span className="text-xs">{algo.replace(' Regression', '')}</span>
                </label>
              ))}
              {filters.algos.length > 0 && (
                <button 
                  onClick={() => setFilters(prev => ({ ...prev, algos: [] }))}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Performance filters */}
          <div className="flex items-center space-x-2">
            <label className="font-medium text-gray-700">R²≥</label>
            <input 
              type="number" 
              min="0" 
              max="1" 
              step="0.1"
              value={filters.minR2}
              onChange={(e) => setFilters(prev => ({ ...prev, minR2: parseFloat(e.target.value) }))}
              className="w-16 text-xs border rounded px-1 py-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="font-medium text-gray-700">MAPE≤</label>
            <input 
              type="number" 
              min="0" 
              max="100" 
              step="1"
              value={filters.maxMAPE}
              onChange={(e) => setFilters(prev => ({ ...prev, maxMAPE: parseFloat(e.target.value) }))}
              className="w-16 text-xs border rounded px-1 py-1"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="font-medium text-gray-700">ROI≥</label>
            <input 
              type="number" 
              min="-10" 
              max="10" 
              step="0.1"
              value={filters.minROI}
              onChange={(e) => setFilters(prev => ({ ...prev, minROI: parseFloat(e.target.value) }))}
              className="w-16 text-xs border rounded px-1 py-1"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm">
          {/* Warning filter */}
          <div>
            <label className="font-medium text-gray-700">Warnings:</label>
            <select 
              value={filters.showWarnings === null ? 'all' : filters.showWarnings.toString()}
              onChange={(e) => {
                const value = e.target.value === 'all' ? null : e.target.value === 'true';
                setFilters(prev => ({ ...prev, showWarnings: value }));
              }}
              className="ml-2 text-xs border rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="true">Only warnings</option>
              <option value="false">No warnings</option>
            </select>
          </div>

          {/* Legacy toggle with warning */}
          {hasStaleModels && (
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox"
                id="showLegacy"
                checked={filters.showLegacy}
                onChange={(e) => setFilters(prev => ({ ...prev, showLegacy: e.target.checked }))}
                className="rounded text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="showLegacy" className="font-medium text-orange-700 flex items-center gap-1">
                <span>⚠️</span>
                <span>Show legacy results (unsafe - mismatched channels/params)</span>
              </label>
            </div>
          )}
        </div>
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 rounded">
            <div>Debug: {models.length} total models, {filteredModels.length} after filters</div>
            <div>Channels: {selectedChannels.join(', ')}</div>
            <div>Active Filters: {JSON.stringify(filters, null, 2)}</div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
        {Object.entries(groupedModels).map(([algo, algoModels]) => (
          <div key={algo} className="mb-6 last:mb-0">
            <h3 className="font-semibold text-gray-800 text-sm mb-2 bg-gray-50 px-2 py-1 rounded">
              {algo.replace(' Regression', '')} ({algoModels.length})
            </h3>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2">Model ID</th>
                  <th className="p-2">Metrics</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {algoModels.slice(0, displayLimit).map((model) => {
                  const isActive = model.id === activeModelId;
                  const isSelected = selectedModelIds.includes(model.id);
                  const badges = getBadges(model);
                  
                  return (
                    <tr key={model.id} 
                      className={`border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-100 ${
                        isActive ? 'bg-[#EC7200]/10' : ''
                      }`}>
                      <td className="p-2">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleModelSelection(model.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td 
                        className="p-2 font-semibold cursor-pointer"
                        onClick={() => onSetActiveModel(model.id)}
                      >
                        {model.id}
                      </td>
                      <td 
                        className="p-2 cursor-pointer"
                        onClick={() => onSetActiveModel(model.id)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-3 text-xs">
                            <span className="font-mono text-[#32A29B]">R²: {model.rsq.toFixed(2)}</span>
                            <span className="font-mono text-[#32A29B]">MAPE: {model.mape.toFixed(1)}%</span>
                            <span className={`font-mono ${model.roi < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ROI: ${model.roi.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {badges.map((badge, idx) => (
                            <span key={idx} className={`px-2 py-0.5 text-xs rounded-full ${badge.className}`}>
                              {badge.text}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {/* Show more button */}
        {!showMore && filteredModels.length > displayLimit && (
          <div className="text-center py-4">
            <button
              onClick={() => setShowMore(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg"
            >
              Show {filteredModels.length - displayLimit} more models
            </button>
          </div>
        )}
      </div>

      {/* Compare footer */}
      {selectedModelIds.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedModelIds.length} model{selectedModelIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="space-x-2">
              <button
                onClick={() => selectedModelIds.forEach(id => onToggleModelSelection(id))}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <button
                disabled={selectedModelIds.length < 2 || selectedModelIds.length > 3}
                onClick={() => {
                  // Trigger parent component's compare functionality
                  const event = new CustomEvent('modelsCompare', { 
                    detail: { selectedModelIds } 
                  });
                  window.dispatchEvent(event);
                }}
                className="px-4 py-2 bg-[#32A29B] hover:bg-[#32A29B]/90 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare ({selectedModelIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};