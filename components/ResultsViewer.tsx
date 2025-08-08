import React, { useState, useMemo, useEffect } from 'react';
import { ModelRun, ResultSummary } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface ResultsViewerProps {
    modelRuns: ModelRun[];
    summary: ResultSummary | null;
    onStartOver: () => void;
}

const COLORS = ['#EC7200', '#32A29B', '#60a5fa', '#f472b6', '#fb923c', '#facc15', '#34d399', '#fb7185'];
const chartColors = {
  grid: 'rgba(26, 22, 40, 0.1)',
  text: '#1A1628'
}

const getConfidenceText = (pValue: number | null): string => {
    if (pValue === null) return 'N/A';
    if (pValue < 0.05) return 'High';
    if (pValue < 0.1) return 'Medium';
    return 'Low';
};

const ModelResult: React.FC<{run: ModelRun}> = ({ run }) => {
    const contributionData = run.details.filter(r => r.name !== 'Base').map(r => ({ name: r.name, value: r.contribution }));
    const baseContribution = run.details.find(r => r.name === 'Base')?.contribution || 0;
    const roiData = run.details.filter(r => r.roi > 0).map(r => ({ name: r.name, value: r.roi }));

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 glass-pane p-6">
                <h3 className="text-lg font-semibold text-center mb-4 text-gray-900">Marketing Contribution (%)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={contributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {contributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip wrapperClassName="glass-pane"/>
                    <Legend wrapperStyle={{color: chartColors.text}} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-sm text-gray-500 mt-2">Base Contribution (Non-Marketing): {baseContribution.toFixed(2)}%</p>
              </div>
              <div className="lg:col-span-3 glass-pane p-6">
                <h3 className="text-lg font-semibold text-center mb-4 text-gray-900">Return on Investment (ROI)</h3>
                 <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={roiData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke={chartColors.text} tick={{ fill: '#374151', fontSize: 12 }}/>
                    <YAxis stroke={chartColors.text} tick={{ fill: '#374151', fontSize: 12 }} />
                    <Tooltip wrapperClassName="glass-pane" cursor={{ fill: 'rgba(0,0,0, 0.05)' }}/>
                    <Bar dataKey="value" name="ROI">
                       {roiData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-pane p-6">
               <h3 className="text-lg font-semibold text-center mb-4 text-gray-900">Detailed Results & Confidence</h3>
               <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="p-3">Channel</th>
                      <th className="p-3 text-right">Contribution %</th>
                      <th className="p-3 text-right">ROI</th>
                      <th className="p-3 text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.details.map((r, index) => (
                      <tr key={index} className="border-b border-gray-200 last:border-b-0">
                        <td className="p-3 font-medium flex items-center"><span className="w-2.5 h-2.5 rounded-full mr-3" style={{backgroundColor: r.name === 'Base' ? '#6b7280' : COLORS[index % COLORS.length]}}></span>{r.name}</td>
                        <td className="p-3 text-right font-mono">{r.contribution.toFixed(2)}%</td>
                        <td className="p-3 text-right font-mono">{r.roi.toFixed(2)}</td>
                        <td className="p-3 text-center">{getConfidenceText(r.pValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </div>
        </div>
    )
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ modelRuns, summary, onStartOver }) => {
    const recommendedRunIndex = useMemo(() => {
        if (!modelRuns || modelRuns.length === 0) return 0;
        return modelRuns.reduce((bestIndex, current, currentIndex, array) => 
            (current.rsq > (array[bestIndex]?.rsq ?? -Infinity)) ? currentIndex : bestIndex, 0
        );
    }, [modelRuns]);
    
    const [selectedTab, setSelectedTab] = useState(recommendedRunIndex);

    useEffect(() => {
        setSelectedTab(recommendedRunIndex);
    }, [recommendedRunIndex]);

    if (modelRuns.length === 0) {
        return <p className="p-8 text-center text-gray-500">No model results to display.</p>;
    }

    return (
        <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
            <div className="glass-pane p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Executive Summary</h3>
                {summary ? (
                    <div className="space-y-4 text-gray-800">
                        <h4 className="text-xl font-semibold text-gray-900">{summary.headline}</h4>
                        <div className="mt-4">
                            <h5 className="font-semibold text-[#32A29B] mb-2">Key Insights</h5>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                {summary.keyInsights.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold text-[#32A29B] mb-2">Recommendations</h5>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                {summary.recommendations.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500">Loading summary...</p>
                )}
            </div>
            
            <div className="glass-pane p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Model Deep Dive</h3>
               <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {modelRuns.map((run, index) => (
                        <button
                            key={run.id}
                            onClick={() => setSelectedTab(index)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                selectedTab === index 
                                ? 'border-[#EC7200] text-[#EC7200]'
                                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                            }`}
                        >
                            {run.id} {index === recommendedRunIndex && '(Recommended)'}
                        </button>
                    ))}
                </nav>
               </div>
               <div className="pt-6">
                 <p className="text-sm text-gray-500 mb-6"><strong>Accuracy (R²):</strong> {modelRuns[selectedTab].rsq.toFixed(3)}</p>
                 <ModelResult run={modelRuns[selectedTab]} />
               </div>
            </div>

            <div className="pt-4 text-center">
              <button onClick={onStartOver} className="px-8 py-3 bg-red-500 hover:bg-red-600 rounded-md font-semibold text-lg transition-colors text-white">Start Over</button>
            </div>
        </div>
    )
};