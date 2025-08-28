import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ModelRun, OptimizerScenario, OptimizerScenarioChannel } from '../types';
import { eqSet } from '../services/modelSelectors';

interface EnhancedOptimizerProps {
    activeModelId: string | null;
    models: ModelRun[];
    selectedChannels: string[];
    scenarios: OptimizerScenario[];
    activeScenarioId: string;
    onSelectScenario: (id: string) => void;
    onUpdateScenario: (scenario: OptimizerScenario) => void;
    onCreateScenario: (scenario: OptimizerScenario) => void;
    onRecalibrate?: () => void;
}

interface ScenarioConstraints {
    globalChangeCap: number; // ±% from current spend
    channelBounds: Record<string, { min: number; max: number; frozen: boolean }>;
    budgetMultiplier: number; // 0.7 to 1.3 (±30%)
}

interface ScenarioProvenance {
    model_id: string;
    features_hash: string;
    ranges_hash: string;
    objective: string;
    bounds: Record<string, { min: number; max: number }>;
    frozen: string[];
    changeCap: number;
    budgetMultiplier: number;
    seed?: number;
    timestamp: number;
}

// Mock response curve calculation (simplified)
const calculateResponseFromCurve = (channel: OptimizerScenarioChannel, newSpend: number): { kpi: number; roi: number } => {
    // Simplified diminishing returns curve
    const efficiency = Math.max(0.1, channel.projectedROI * Math.pow(0.95, newSpend / channel.currentSpend - 1));
    const kpi = newSpend * efficiency;
    const roi = efficiency;
    
    return { kpi, roi };
};

const ConstraintsDrawer: React.FC<{
    constraints: ScenarioConstraints;
    channels: string[];
    isOpen: boolean;
    onClose: () => void;
    onChange: (constraints: ScenarioConstraints) => void;
}> = ({ constraints, channels, isOpen, onClose, onChange }) => {
    if (!isOpen) return null;

    const handleChannelBoundChange = (channel: string, field: 'min' | 'max', value: number) => {
        const newConstraints = {
            ...constraints,
            channelBounds: {
                ...constraints.channelBounds,
                [channel]: {
                    ...constraints.channelBounds[channel],
                    [field]: Math.max(0, Math.min(100, value))
                }
            }
        };
        onChange(newConstraints);
    };

    const handleFreezeToggle = (channel: string) => {
        const newConstraints = {
            ...constraints,
            channelBounds: {
                ...constraints.channelBounds,
                [channel]: {
                    ...constraints.channelBounds[channel],
                    frozen: !constraints.channelBounds[channel]?.frozen
                }
            }
        };
        onChange(newConstraints);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-80vh overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Edit Constraints</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Global Change Cap: ±{constraints.globalChangeCap}%
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={constraints.globalChangeCap}
                                onChange={(e) => onChange({
                                    ...constraints,
                                    globalChangeCap: parseInt(e.target.value)
                                })}
                                className="w-full"
                            />
                        </div>
                        
                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-3">Per-Channel Constraints</h4>
                            <div className="space-y-3">
                                {channels.map(channel => {
                                    const bounds = constraints.channelBounds[channel] || { min: 0, max: 100, frozen: false };
                                    return (
                                        <div key={channel} className="grid grid-cols-5 gap-3 items-center text-sm">
                                            <div className="font-medium">{channel}</div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Min %</label>
                                                <input
                                                    type="number"
                                                    value={bounds.min}
                                                    onChange={(e) => handleChannelBoundChange(channel, 'min', parseFloat(e.target.value) || 0)}
                                                    className="w-full p-1 border rounded text-xs"
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Max %</label>
                                                <input
                                                    type="number"
                                                    value={bounds.max}
                                                    onChange={(e) => handleChannelBoundChange(channel, 'max', parseFloat(e.target.value) || 100)}
                                                    className="w-full p-1 border rounded text-xs"
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                            <div>
                                                <label className="flex items-center text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={bounds.frozen}
                                                        onChange={() => handleFreezeToggle(channel)}
                                                        className="mr-1"
                                                    />
                                                    Freeze
                                                </label>
                                            </div>
                                            <div>
                                                {bounds.frozen && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                        Frozen
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="primary-button">
                        Apply Constraints
                    </button>
                </div>
            </div>
        </div>
    );
};

const CompareView: React.FC<{
    scenarios: [OptimizerScenario, OptimizerScenario];
    onClose: () => void;
    onDuplicate: (scenario: OptimizerScenario) => void;
}> = ({ scenarios, onClose, onDuplicate }) => {
    const [scenarioA, scenarioB] = scenarios;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-90vh overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-semibold">Compare Scenarios</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        {scenarios.map((scenario, index) => (
                            <div key={scenario.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-lg">
                                        {scenario.title}
                                    </h4>
                                    <button
                                        onClick={() => onDuplicate(scenario)}
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                                    >
                                        Duplicate
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-gray-500">Total Budget</div>
                                        <div className="font-bold">${scenario.recommendedSpend.toFixed(1)}M</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <div className="text-gray-500">Projected ROI</div>
                                        <div className={`font-bold ${scenario.projectedROI < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${scenario.projectedROI.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded col-span-2">
                                        <div className="text-gray-500">Net Revenue</div>
                                        <div className={`font-bold ${scenario.netRevenue < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${scenario.netRevenue.toFixed(1)}M
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Channel Allocation</div>
                                    {scenario.channels.map(channel => (
                                        <div key={channel.name} className="flex justify-between items-center text-xs">
                                            <span>{channel.name}</span>
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-16 h-2 rounded ${index === 0 ? 'bg-blue-200' : 'bg-green-200'}`}>
                                                    <div 
                                                        className={`h-2 rounded ${index === 0 ? 'bg-blue-500' : 'bg-green-500'}`}
                                                        style={{ 
                                                            width: `${Math.min(100, (channel.recommendedSpend / scenario.recommendedSpend) * 100)}%` 
                                                        }}
                                                    />
                                                </div>
                                                <span className="font-mono text-xs">
                                                    ${channel.recommendedSpend.toFixed(1)}M
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EditableScenarioTable: React.FC<{
    scenario: OptimizerScenario;
    constraints: ScenarioConstraints;
    onScenarioChange: (scenario: OptimizerScenario) => void;
    onRevertChannel: (channelName: string) => void;
}> = ({ scenario, constraints, onScenarioChange, onRevertChannel }) => {
    const handleSpendChange = (channelName: string, newSpend: number) => {
        const updatedChannels = scenario.channels.map(channel => {
            if (channel.name === channelName) {
                const response = calculateResponseFromCurve(channel, newSpend);
                const change = ((newSpend - channel.currentSpend) / channel.currentSpend) * 100;
                
                return {
                    ...channel,
                    recommendedSpend: newSpend,
                    change,
                    projectedROI: response.roi,
                };
            }
            return channel;
        });
        
        const totalSpend = updatedChannels.reduce((sum, ch) => sum + ch.recommendedSpend, 0);
        const totalKPI = updatedChannels.reduce((sum, ch) => sum + ch.recommendedSpend * ch.projectedROI, 0);
        const avgROI = totalSpend > 0 ? totalKPI / totalSpend : 0;
        
        const updatedScenario: OptimizerScenario = {
            ...scenario,
            channels: updatedChannels,
            recommendedSpend: totalSpend,
            projectedROI: avgROI,
            netRevenue: totalKPI - totalSpend
        };
        
        onScenarioChange(updatedScenario);
    };

    return (
        <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-3">Channel</th>
                        <th className="p-3">Current Spend</th>
                        <th className="p-3">Recommended Spend</th>
                        <th className="p-3">Change</th>
                        <th className="p-3">Projected ROI</th>
                        <th className="p-3">Actions</th>
                        <th className="p-3 w-1/4">Agent Commentary</th>
                    </tr>
                </thead>
                <tbody>
                    {scenario.channels.map(channel => {
                        const changeColor = channel.change >= 0 ? 'text-green-600' : 'text-red-600';
                        const roiColor = channel.projectedROI < 0 ? 'text-red-600' : 'text-green-600';
                        const bounds = constraints.channelBounds[channel.name];
                        const isFrozen = bounds?.frozen;
                        const isAtBound = bounds && (
                            (channel.recommendedSpend / scenario.recommendedSpend * 100) <= bounds.min ||
                            (channel.recommendedSpend / scenario.recommendedSpend * 100) >= bounds.max
                        );
                        
                        return (
                            <tr key={channel.name} className="border-b border-gray-200">
                                <td className="p-3 font-semibold">
                                    <div className="flex items-center space-x-2">
                                        <span>{channel.name}</span>
                                        {isFrozen && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                Frozen
                                            </span>
                                        )}
                                        {isAtBound && (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                                At Bound
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3">${channel.currentSpend.toFixed(1)}M</td>
                                <td className="p-3">
                                    {isFrozen ? (
                                        <span className="font-bold">${channel.recommendedSpend.toFixed(1)}M</span>
                                    ) : (
                                        <input
                                            type="number"
                                            value={channel.recommendedSpend.toFixed(1)}
                                            onChange={(e) => handleSpendChange(channel.name, parseFloat(e.target.value) || 0)}
                                            className="w-20 p-1 border rounded font-mono text-xs"
                                            step="0.1"
                                            min="0"
                                        />
                                    )}
                                </td>
                                <td className={`p-3 font-bold ${changeColor}`}>
                                    {channel.change >= 0 ? '+' : ''}{channel.change.toFixed(0)}%
                                </td>
                                <td className={`p-3 font-bold ${roiColor}`}>
                                    ${channel.projectedROI.toFixed(2)}
                                </td>
                                <td className="p-3">
                                    <button
                                        onClick={() => onRevertChannel(channel.name)}
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                                        title="Revert to solver recommendation"
                                    >
                                        Revert
                                    </button>
                                </td>
                                <td className="p-3 text-gray-500 text-xs italic">
                                    {channel.agentCommentary}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export const EnhancedOptimizer: React.FC<EnhancedOptimizerProps> = ({ 
    activeModelId,
    models,
    selectedChannels,
    scenarios, 
    activeScenarioId, 
    onSelectScenario,
    onUpdateScenario,
    onCreateScenario,
    onRecalibrate
}) => {
    const [constraints, setConstraints] = useState<ScenarioConstraints>({
        globalChangeCap: 30,
        channelBounds: {},
        budgetMultiplier: 1.0
    });
    const [showConstraintsDrawer, setShowConstraintsDrawer] = useState(false);
    const [compareScenarios, setCompareScenarios] = useState<string[]>([]);
    const [showCompareView, setShowCompareView] = useState(false);
    const [baselineScenario, setBaselineScenario] = useState<OptimizerScenario | null>(null);
    
    // Get active model and check consistency
    const model = useMemo(() => {
        return activeModelId ? models.find(m => m.id === activeModelId) : null;
    }, [activeModelId, models]);
    
    // Check strict model consistency
    const isConsistent = useMemo(() => {
        if (!model || !activeModelId) return false;
        
        const modelChannels = new Set(model.channels || []);
        const selectedChannelsSet = new Set(selectedChannels);
        
        return eqSet(modelChannels, selectedChannelsSet);
    }, [model, selectedChannels, activeModelId]);
    
    // Initialize constraints and baseline scenario
    useEffect(() => {
        if (model && scenarios.length > 0) {
            const activeScenario = scenarios.find(s => s.id === activeScenarioId);
            if (activeScenario) {
                // Set baseline scenario when switching scenarios (for budget slider reference)
                if (!baselineScenario || baselineScenario.id !== activeScenario.id) {
                    setBaselineScenario(JSON.parse(JSON.stringify(activeScenario))); // Deep copy
                    setConstraints(prev => ({ ...prev, budgetMultiplier: 1.0 })); // Reset multiplier
                }
                
                const newConstraints = { ...constraints };
                activeScenario.channels.forEach(channel => {
                    if (!newConstraints.channelBounds[channel.name]) {
                        newConstraints.channelBounds[channel.name] = {
                            min: 0,
                            max: 100,
                            frozen: false
                        };
                    }
                });
                setConstraints(prev => ({ ...prev, channelBounds: newConstraints.channelBounds }));
            }
        }
    }, [model, scenarios, activeScenarioId]);
    
    const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
    
    const handleRevertChannel = useCallback((channelName: string) => {
        if (!activeScenario || !baselineScenario) return;
        
        // Find original recommendation from baseline scenario
        const baselineChannel = baselineScenario.channels.find(ch => ch.name === channelName);
        if (baselineChannel) {
            // Revert to baseline recommendation (scaled by current multiplier)
            const targetSpend = baselineChannel.recommendedSpend * constraints.budgetMultiplier;
            const response = calculateResponseFromCurve(baselineChannel, targetSpend);
            const change = ((targetSpend - baselineChannel.currentSpend) / baselineChannel.currentSpend) * 100;
            
            const updatedChannels = activeScenario.channels.map(ch => 
                ch.name === channelName 
                    ? { 
                        ...ch, 
                        recommendedSpend: targetSpend,
                        change,
                        projectedROI: response.roi
                      }
                    : ch
            );
            
            const totalSpend = updatedChannels.reduce((sum, ch) => sum + ch.recommendedSpend, 0);
            const totalKPI = updatedChannels.reduce((sum, ch) => sum + ch.recommendedSpend * ch.projectedROI, 0);
            
            handleScenarioChange({
                ...activeScenario,
                channels: updatedChannels,
                recommendedSpend: totalSpend,
                projectedROI: totalSpend > 0 ? totalKPI / totalSpend : 0,
                netRevenue: totalKPI - totalSpend
            });
        }
    }, [activeScenario, baselineScenario, constraints.budgetMultiplier, onUpdateScenario]);
    
    const handleScenarioChange = useCallback((scenario: OptimizerScenario) => {
        onUpdateScenario(scenario);
    }, [onUpdateScenario]);
    
    const handleBudgetSliderChange = useCallback((multiplier: number) => {
        if (!activeScenario || !baselineScenario) return;
        
        // Update constraints with new multiplier
        setConstraints(prev => ({ ...prev, budgetMultiplier: multiplier }));
        
        // Scale from baseline scenario, not current scenario
        const scaledChannels = baselineScenario.channels.map(baseChannel => {
            const scaledSpend = baseChannel.recommendedSpend * multiplier;
            const response = calculateResponseFromCurve(baseChannel, scaledSpend);
            const change = ((scaledSpend - baseChannel.currentSpend) / baseChannel.currentSpend) * 100;
            
            return {
                ...baseChannel,
                recommendedSpend: scaledSpend,
                change,
                projectedROI: response.roi,
            };
        });
        
        const totalSpend = scaledChannels.reduce((sum, ch) => sum + ch.recommendedSpend, 0);
        const totalKPI = scaledChannels.reduce((sum, ch) => sum + ch.recommendedSpend * ch.projectedROI, 0);
        
        const updatedScenario: OptimizerScenario = {
            ...activeScenario,
            channels: scaledChannels,
            recommendedSpend: totalSpend,
            projectedROI: totalSpend > 0 ? totalKPI / totalSpend : 0,
            netRevenue: totalKPI - totalSpend
        };
        
        onUpdateScenario(updatedScenario);
    }, [activeScenario, baselineScenario, onUpdateScenario]);
    
    const handleExport = useCallback(() => {
        if (!activeScenario || !model) return;
        
        const provenance: ScenarioProvenance = {
            model_id: model.id,
            features_hash: 'mock_hash', // In real app, compute from features
            ranges_hash: 'mock_hash', // In real app, compute from ranges
            objective: 'maximize_roi',
            bounds: constraints.channelBounds,
            frozen: Object.keys(constraints.channelBounds).filter(ch => constraints.channelBounds[ch].frozen),
            changeCap: constraints.globalChangeCap,
            budgetMultiplier: constraints.budgetMultiplier,
            timestamp: Date.now()
        };
        
        let csvContent = 'Channel,Current,Recommended,Change%,Projected ROI,Notes\n';
        activeScenario.channels.forEach(ch => {
            csvContent += `${ch.name},${ch.currentSpend},${ch.recommendedSpend},${ch.change.toFixed(1)},${ch.projectedROI.toFixed(2)},"${ch.agentCommentary}"\n`;
        });
        
        csvContent += `\nProvenance:\n`;
        csvContent += `Model ID,${provenance.model_id}\n`;
        csvContent += `Timestamp,${new Date(provenance.timestamp).toISOString()}\n`;
        csvContent += `Change Cap,${provenance.changeCap}%\n`;
        csvContent += `Budget Multiplier,${provenance.budgetMultiplier}\n`;
        csvContent += `Frozen Channels,"${provenance.frozen.join(', ')}"\n`;
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Optimizer-${activeScenario.id}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [activeScenario, model, constraints]);
    
    const handleToggleCompare = useCallback((scenarioId: string) => {
        setCompareScenarios(prev => {
            if (prev.includes(scenarioId)) {
                return prev.filter(id => id !== scenarioId);
            } else if (prev.length < 2) {
                return [...prev, scenarioId];
            } else {
                return [prev[1], scenarioId];
            }
        });
    }, []);
    
    const handleDuplicateScenario = useCallback((scenario: OptimizerScenario) => {
        const newScenario: OptimizerScenario = {
            ...scenario,
            id: `custom_${Date.now()}`,
            title: `${scenario.title} (Copy)`
        };
        onCreateScenario(newScenario);
        setShowCompareView(false);
    }, [onCreateScenario]);

    // Handle no active model
    if (!activeModelId) {
        return (
            <div className="p-8 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Model Selected</h3>
                <p className="text-gray-600">Please go back to the Report tab and select a model.</p>
            </div>
        );
    }

    // Handle consistency issues
    if (!isConsistent) {
        return (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
                <div className="glass-pane p-8 text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Recalibration Required</h3>
                    <p className="text-gray-600 mb-2">Model channels don't match current selections.</p>
                    <p className="text-sm text-gray-500 mb-6">
                        Model channels: [{model?.channels?.join(', ')}] | Selected: [{selectedChannels.join(', ')}]
                    </p>
                    {onRecalibrate && (
                        <button
                            onClick={onRecalibrate}
                            className="px-6 py-3 bg-[#EC7200] hover:bg-[#EC7200]/90 text-white font-medium rounded-lg"
                        >
                            Recalibrate Now
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!model || scenarios.length === 0) {
        return <p className="p-8 text-center">No optimization scenarios available. Please finalize a model first.</p>;
    }

    return (
        <div className="p-4 md:p-6 max-w-full mx-auto h-full">
            <div className="glass-pane p-6 h-full flex flex-col">
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Budget Optimization</h2>
                    <p className="text-gray-600">
                        Based on active model <strong>{model.id}</strong>. Edit spend allocations and constraints below.
                    </p>
                </div>

                {/* Constraints Strip */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">Budget:</span>
                                <input
                                    type="range"
                                    min="0.7"
                                    max="1.3"
                                    step="0.05"
                                    value={constraints.budgetMultiplier}
                                    onChange={(e) => handleBudgetSliderChange(parseFloat(e.target.value))}
                                    className="w-32"
                                />
                                <span className="text-sm font-mono">
                                    {(constraints.budgetMultiplier * 100 - 100).toFixed(0)}%
                                </span>
                            </div>
                            
                            <div className="text-sm">
                                <span className="font-medium">Change Cap:</span> ±{constraints.globalChangeCap}%
                            </div>
                            
                            <button
                                onClick={() => setShowConstraintsDrawer(true)}
                                className="text-sm px-3 py-1 bg-white border rounded hover:bg-gray-50"
                            >
                                Edit Constraints
                            </button>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            {compareScenarios.length === 2 && (
                                <button
                                    onClick={() => setShowCompareView(true)}
                                    className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                    Compare ({compareScenarios.length})
                                </button>
                            )}
                            <button onClick={handleExport} className="secondary-button text-sm">
                                Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-grow flex gap-8 overflow-hidden">
                    {/* Scenario List */}
                    <nav className="w-1/3 md:w-1/4 flex-shrink-0 overflow-y-auto custom-scrollbar pr-4 -mr-4 border-r border-gray-200">
                        <ul className="space-y-2">
                            {scenarios.map(scenario => {
                                const isActive = scenario.id === activeScenarioId;
                                const isCompareSelected = compareScenarios.includes(scenario.id);
                                
                                return (
                                    <li key={scenario.id}>
                                        <div className="flex items-center space-x-2">
                                            <button 
                                                onClick={() => onSelectScenario(scenario.id)} 
                                                className={`flex-grow text-left p-3 rounded-lg transition-colors relative text-sm ${
                                                    isActive 
                                                    ? 'bg-[#EC7200]/20 text-[#1A1628] font-semibold' 
                                                    : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-[#EC7200] rounded-l-lg"></div>}
                                                {scenario.title}
                                            </button>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isCompareSelected}
                                                    onChange={() => handleToggleCompare(scenario.id)}
                                                    className="w-4 h-4"
                                                    disabled={compareScenarios.length >= 2 && !isCompareSelected}
                                                />
                                            </label>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Scenario Details */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
                        {activeScenario && (
                            <div className="animate-fade-in flex flex-col h-full">
                                {/* Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6">
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <div className="text-sm text-gray-500">Total Budget</div>
                                        <div className="text-3xl font-bold">${activeScenario.recommendedSpend.toFixed(1)}M</div>
                                    </div>
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <div className="text-sm text-gray-500">Projected ROI</div>
                                        <div className={`text-3xl font-bold ${activeScenario.projectedROI < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${activeScenario.projectedROI.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <div className="text-sm text-gray-500">Net Revenue</div>
                                        <div className={`text-3xl font-bold ${activeScenario.netRevenue < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${activeScenario.netRevenue.toFixed(1)}M
                                        </div>
                                    </div>
                                </div>

                                {/* Editable Table */}
                                <EditableScenarioTable
                                    scenario={activeScenario}
                                    constraints={constraints}
                                    onScenarioChange={handleScenarioChange}
                                    onRevertChannel={handleRevertChannel}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals */}
                {showConstraintsDrawer && (
                    <ConstraintsDrawer
                        constraints={constraints}
                        channels={activeScenario?.channels.map(ch => ch.name) || []}
                        isOpen={showConstraintsDrawer}
                        onClose={() => setShowConstraintsDrawer(false)}
                        onChange={setConstraints}
                    />
                )}

                {showCompareView && compareScenarios.length === 2 && (
                    <CompareView
                        scenarios={compareScenarios.map(id => scenarios.find(s => s.id === id)!).filter(Boolean) as [OptimizerScenario, OptimizerScenario]}
                        onClose={() => setShowCompareView(false)}
                        onDuplicate={handleDuplicateScenario}
                    />
                )}
            </div>
        </div>
    );
};