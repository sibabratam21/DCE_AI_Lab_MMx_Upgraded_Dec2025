

import React from 'react';
import { FeatureParams } from '../types';

interface FeatureEngineeringProps {
    initialParams: FeatureParams[];
    onParamsChange: (params: FeatureParams[]) => void;
    agentSummary: string;
}

export const FeatureEngineering: React.FC<FeatureEngineeringProps> = ({ initialParams, onParamsChange, agentSummary }) => {

    const handleParamChange = (channel: string, field: keyof FeatureParams, value: any) => {
        onParamsChange(
            initialParams.map(p => p.channel === channel ? { ...p, [field]: value } : p)
        );
    };
    
    if (initialParams.length === 0) {
        return <p className="p-8 text-center">Loading feature recommendations...</p>
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
            {agentSummary && (
                <div className="glass-pane p-6 animate-fade-in">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Agent's Analysis</h3>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                        {agentSummary}
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
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min="0"
                                                max="0.95"
                                                step="0.05"
                                                value={p.adstock}
                                                onChange={(e) => handleParamChange(p.channel, 'adstock', parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-thumb"
                                            />
                                            <span className="font-mono text-gray-700 w-12 text-center">{p.adstock.toFixed(2)}</span>
                                        </div>
                                    </td>
                                     <td className="p-3">
                                        <div className="flex items-center gap-3">
                                             <input
                                                type="range"
                                                min="0"
                                                max="8"
                                                step="1"
                                                value={p.lag}
                                                onChange={(e) => handleParamChange(p.channel, 'lag', parseInt(e.target.value, 10))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-thumb"
                                            />
                                            <span className="font-mono text-gray-700 w-10 text-center">{p.lag}</span>
                                        </div>
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
                                    <td className="p-3 text-gray-500 text-xs italic">{p.rationale}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};