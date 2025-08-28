

import React, { useState } from 'react';
import { FeatureParams, ParameterRange } from '../types';
import { DualRangeSlider } from './DualRangeSlider';

interface FeatureEngineeringProps {
    initialParams: FeatureParams[];
    onParamsChange: (params: FeatureParams[]) => void;
    agentSummary: string;
    onProceed?: () => void;
    isLoading?: boolean;
}

export const FeatureEngineering: React.FC<FeatureEngineeringProps> = ({ initialParams, onParamsChange, agentSummary, onProceed, isLoading }) => {
    const [lockedChannels, setLockedChannels] = useState<{ [channel: string]: { adstock: boolean; lag: boolean } }>({});

    const handleParamChange = (channel: string, field: keyof FeatureParams, value: any) => {
        onParamsChange(
            initialParams.map(p => p.channel === channel ? { ...p, [field]: value } : p)
        );
    };

    const handleRangeChange = (channel: string, field: 'adstock' | 'lag', range: ParameterRange) => {
        handleParamChange(channel, field, range);
    };

    const handleLockChange = (channel: string, field: 'adstock' | 'lag', locked: boolean) => {
        setLockedChannels(prev => ({
            ...prev,
            [channel]: {
                ...prev[channel],
                [field]: locked
            }
        }));
    };
    
    if (initialParams.length === 0) {
        return <p className="p-8 text-center">Loading feature recommendations...</p>
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
            {agentSummary && (
                <div className="glass-pane p-6 animate-fade-in">
                    <div className="prose prose-sm max-w-none text-gray-700">
                        {agentSummary.split('\n').map((line, idx) => {
                            // Handle headers
                            if (line.startsWith('##')) {
                                const level = line.match(/^#+/)?.[0].length || 2;
                                const text = line.replace(/^#+\s*/, '');
                                if (level === 2) {
                                    return <h2 key={idx} className="text-xl font-bold text-gray-900 mt-4 mb-3">{text}</h2>;
                                } else if (level === 3) {
                                    return <h3 key={idx} className="text-lg font-semibold text-gray-800 mt-3 mb-2">{text}</h3>;
                                }
                            }
                            // Handle bold sections
                            if (line.includes('**')) {
                                const parts = line.split(/\*\*(.*?)\*\*/g);
                                return (
                                    <p key={idx} className="mb-2">
                                        {parts.map((part, i) => 
                                            i % 2 === 0 ? part : <strong key={i} className="font-semibold text-gray-900">{part}</strong>
                                        )}
                                    </p>
                                );
                            }
                            // Handle bullet points
                            if (line.startsWith('•') || line.startsWith('-')) {
                                return <li key={idx} className="ml-4 mb-1">{line.substring(1).trim()}</li>;
                            }
                            // Regular text
                            if (line.trim()) {
                                return <p key={idx} className="mb-2">{line}</p>;
                            }
                            return null;
                        })}
                    </div>
                </div>
            )}

            <div className="glass-pane p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Feature Engineering</h3>
                <p className="text-gray-600 mb-6">Review and adjust the agent's recommended parameters. Your domain expertise is valuable here.</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 w-1/6">Channel</th>
                                <th className="p-3 w-1/4">Adstock (Decay)</th>
                                <th className="p-3 w-1/4">Lag (Weeks)</th>
                                <th className="p-3 w-1/6">Transformation</th>
                                <th className="p-3">AI Rationale</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialParams.map(p => (
                                <tr key={p.channel} className="border-b border-gray-200">
                                    <td className="p-3 font-semibold">{p.channel}</td>
                                    <td className="p-3">
                                        <DualRangeSlider
                                            min={0}
                                            max={0.95}
                                            step={0.05}
                                            value={p.adstock}
                                            onChange={(range) => handleRangeChange(p.channel, 'adstock', range)}
                                            formatValue={(v) => v.toFixed(2)}
                                            label=""
                                            isLocked={lockedChannels[p.channel]?.adstock || false}
                                            onLockChange={(locked) => handleLockChange(p.channel, 'adstock', locked)}
                                        />
                                    </td>
                                     <td className="p-3">
                                        <DualRangeSlider
                                            min={0}
                                            max={8}
                                            step={1}
                                            value={p.lag}
                                            onChange={(range) => handleRangeChange(p.channel, 'lag', range)}
                                            formatValue={(v) => v.toString()}
                                            label=""
                                            isLocked={lockedChannels[p.channel]?.lag || false}
                                            onLockChange={(locked) => handleLockChange(p.channel, 'lag', locked)}
                                        />
                                    </td>
                                     <td className="p-2">
                                        <select 
                                            value={p.transform}
                                            onChange={(e) => handleParamChange(p.channel, 'transform', e.target.value)}
                                            className="w-full p-2 bg-white border border-gray-300 rounded-md"
                                        >
                                            <option>Log-transform</option>
                                            <option>Negative Exponential</option>
                                            <option>S-Curve</option>
                                            <option>Power</option>
                                        </select>
                                    </td>
                                    <td className="p-3 text-gray-600 text-xs">
                                        <div className="space-y-1 whitespace-pre-wrap">
                                            {p.rationale.split('\n').map((line, idx) => {
                                                if (line.startsWith('**Why')) {
                                                    const [label, ...rest] = line.split(':');
                                                    return (
                                                        <div key={idx}>
                                                            <span className="font-semibold text-gray-800">
                                                                {label.replace(/\*/g, '')}:
                                                            </span>
                                                            <span className="text-gray-600">
                                                                {rest.join(':')}
                                                            </span>
                                                        </div>
                                                    );
                                                } else if (line.startsWith('**Watchout')) {
                                                    const [label, ...rest] = line.split(':');
                                                    return (
                                                        <div key={idx} className="mt-1 p-1 bg-yellow-50 rounded">
                                                            <span className="font-semibold text-yellow-800">
                                                                ⚠️ {label.replace(/\*/g, '')}:
                                                            </span>
                                                            <span className="text-yellow-700">
                                                                {rest.join(':')}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return <div key={idx}>{line}</div>;
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Proceed Button */}
                {onProceed && (
                    <div className="flex justify-end mt-8">
                        <button
                            onClick={onProceed}
                            disabled={isLoading || initialParams.length === 0}
                            className="primary-button flex items-center space-x-2"
                        >
                            <span>Proceed to Modeling</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};