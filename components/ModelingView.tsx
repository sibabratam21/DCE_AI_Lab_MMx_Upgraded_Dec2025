import React from 'react';
import { ModelRun, ModelDetail } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader } from './Loader';

interface ModelingViewProps {
    models: ModelRun[];
    activeModelId: string | null;
    onSetActiveModel: (id: string | null) => void;
    onModelChange: (model: ModelRun) => void;
    onRequestFinalize: () => void;
    isRecalibrating: boolean;
}

const chartColors = {
  grid: 'rgba(26, 22, 40, 0.1)',
  text: '#1A1628'
}

const ActiveModelDetail: React.FC<{ model: ModelRun; onModelChange: (model: ModelRun) => void; onRequestFinalize: () => void; isRecalibrating: boolean; }> = ({ model, onModelChange, onRequestFinalize, isRecalibrating }) => {
    
    const handleParameterChange = (channelName: string, field: keyof ModelDetail, value: any) => {
        const newDetails = model.details.map(d =>
            d.name === channelName ? { ...d, [field]: value } : d
        );
        onModelChange({ ...model, details: newDetails });
    };
    
    const roiColor = model.roi > 0 ? 'text-green-600' : 'text-red-600';

    return (
        <div className="glass-pane p-6 h-full flex flex-col relative">
            {isRecalibrating && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex justify-center items-center rounded-lg z-10 transition-opacity">
                    <div className="text-center">
                        <Loader />
                        <p className="mt-2 font-medium text-gray-600">Recalibrating model...</p>
                    </div>
                </div>
            )}
            <div className={`flex flex-col h-full ${isRecalibrating ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Active Model: {model.id} ({model.algo})</h3>
                <p className="text-gray-600 mb-6 text-sm">{model.commentary}</p>
                
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">R-Square</div><div className="text-2xl font-bold text-[#32A29B]">{model.rsq.toFixed(2)}</div></div>
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">MAPE</div><div className="text-2xl font-bold text-[#32A29B]">{model.mape.toFixed(1)}%</div></div>
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">Blended ROI</div><div className={`text-2xl font-bold ${roiColor}`}>${model.roi.toFixed(2)}</div></div>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-6">
                    <div>
                        <h4 className="font-semibold text-gray-800 mb-4">Channel Contribution</h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={model.details} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} stroke={chartColors.text} fontSize={12} interval={0} />
                                <Tooltip wrapperClassName="glass-pane" cursor={{ fill: 'rgba(0,0,0, 0.05)' }} formatter={(value: number) => `${value.toFixed(1)}%`}/>
                                <Bar dataKey="contribution" name="Contribution" stackId="a">
                                    {model.details.map((p, index) => (
                                        <Cell key={`cell-${index}`} fill={p.included ? (p.pValue != null && p.pValue > 0.1 ? '#f87171' : '#32A29B') : '#9ca3af'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div>
                        <h4 className="font-semibold text-gray-800">Manual Parameter Calibration</h4>
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Channel</th><th className="p-2">Adstock</th><th className="p-2">Lag</th><th className="p-2">Transform</th></tr></thead>
                                <tbody>
                                    {model.details.map(p => (
                                    <tr key={p.name} className="border-b border-gray-200">
                                        <td className="py-2 px-2">
                                            <label className="flex items-center">
                                                <input type="checkbox" className="h-4 w-4 rounded bg-gray-200 border-gray-300 text-[#EC7200] focus:ring-[#EC7200]" checked={p.included} onChange={(e) => handleParameterChange(p.name, 'included', e.target.checked)} />
                                                <span className="ml-2.5 font-semibold">{p.name}</span>
                                                {p.pValue !== null && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${p.pValue > 0.1 ? 'bg-red-500/20 text-red-700' : 'bg-green-500/20 text-green-700'}`}>p={p.pValue.toFixed(2)}</span>}
                                            </label>
                                        </td>
                                        <td><input type="number" step="0.05" value={p.adstock} onChange={e => handleParameterChange(p.name, 'adstock', parseFloat(e.target.value))} className="w-20 p-1 bg-white border border-gray-300 rounded-md" /></td>
                                        <td><input type="number" value={p.lag} onChange={e => handleParameterChange(p.name, 'lag', parseInt(e.target.value))} className="w-20 p-1 bg-white border border-gray-300 rounded-md" /></td>
                                        <td>
                                            <select value={p.transform} onChange={e => handleParameterChange(p.name, 'transform', e.target.value as any)} className="w-full p-1 bg-white border border-gray-300 rounded-md">
                                                <option>Log-transform</option>
                                                <option>Negative Exponential</option>
                                                <option>S-Curve</option>
                                                <option>Power</option>
                                            </select>
                                        </td>
                                    </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-6">
                    <button
                        onClick={onRequestFinalize}
                        className="w-full primary-button text-base font-semibold py-3 flex items-center justify-center gap-2"
                    >
                        Finalize Model &amp; Generate Report
                    </button>
                </div>
            </div>
        </div>
    );
}

export const ModelingView: React.FC<ModelingViewProps> = ({ models, activeModelId, onSetActiveModel, onModelChange, onRequestFinalize, isRecalibrating }) => {
    
    if (models.length === 0) {
        return <p className="p-8 text-center">Waiting for model results...</p>;
    }

    const activeModel = models.find(m => m.id === activeModelId);
    
    // Sort models to show the newest (calibrated) ones on top
    const sortedModels = [...models].sort((a, b) => {
        const aIsCalibrated = a.id.includes('_cal_');
        const bIsCalibrated = b.id.includes('_cal_');
        if (aIsCalibrated && !bIsCalibrated) return -1;
        if (!aIsCalibrated && bIsCalibrated) return 1;
        return 0; // Or add more sophisticated date-based sorting if needed
    });


    return (
        <div className="flex h-full p-4 md:p-6 gap-6">
            {/* Leaderboard */}
            <div className="w-1/2 flex flex-col glass-pane p-4">
                <h2 className="text-xl font-bold text-center mb-4">Model Leaderboard</h2>
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="p-2">Model ID</th>
                                <th className="p-2">Algo</th>
                                <th className="p-2">R-Sq</th>
                                <th className="p-2">MAPE</th>
                                <th className="p-2">ROI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedModels.map((model) => {
                                const roiColor = model.roi < 0 ? 'text-red-600' : 'text-green-600';
                                const isActive = model.id === activeModelId;
                                return (
                                <tr key={model.id} 
                                    onClick={() => onSetActiveModel(model.id)}
                                    className={`border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-100 ${isActive ? 'bg-[#EC7200]/10' : ''}`}>
                                    <td className="p-2 font-semibold">{model.id}</td>
                                    <td className="p-2 text-gray-500">{model.algo.replace(' Regression', '')}</td>
                                    <td className="p-2 font-mono text-[#32A29B]">{model.rsq.toFixed(2)}</td>
                                    <td className="p-2 font-mono text-[#32A29B]">{model.mape.toFixed(1)}%</td>
                                    <td className={`p-2 font-mono ${roiColor}`}>${model.roi.toFixed(2)}</td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Active Model Details & Calibration */}
            <div className="w-1/2">
                {activeModel ? (
                    <ActiveModelDetail model={activeModel} onModelChange={onModelChange} onRequestFinalize={onRequestFinalize} isRecalibrating={isRecalibrating}/>
                ) : (
                    <div className="glass-pane h-full flex flex-col items-center justify-center text-center p-8">
                        <h3 className="text-xl font-semibold text-gray-900">Select a Model</h3>
                        <p className="text-gray-600 mt-2">Click a model from the leaderboard on the left to view its detailed results, ask questions about it, or tune its parameters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};