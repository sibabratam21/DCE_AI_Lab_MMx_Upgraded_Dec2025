import React from 'react';
import { ModelRun } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ModelCompareProps {
  models: ModelRun[];
  onClose: () => void;
}

const ComparisonCard: React.FC<{ model: ModelRun; index: number }> = ({ model, index }) => {
  const roiColor = model.roi > 0 ? 'text-green-600' : 'text-red-600';
  const chartColors = { grid: 'rgba(26, 22, 40, 0.1)', text: '#1A1628' };
  
  const cardColors = [
    'border-blue-500 bg-blue-50',
    'border-green-500 bg-green-50', 
    'border-purple-500 bg-purple-50'
  ];

  return (
    <div className={`rounded-lg border-2 p-4 space-y-4 ${cardColors[index]} flex-1`}>
      <div className="text-center">
        <h3 className="font-semibold text-gray-900 mb-1">{model.id}</h3>
        <p className="text-sm text-gray-600">{model.algo.replace(' Regression', '')}</p>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white p-2 rounded">
          <div className="text-xs text-gray-500">R²</div>
          <div className="font-bold text-[#32A29B]">{model.rsq.toFixed(2)}</div>
        </div>
        <div className="bg-white p-2 rounded">
          <div className="text-xs text-gray-500">MAPE</div>
          <div className="font-bold text-[#32A29B]">{model.mape.toFixed(1)}%</div>
        </div>
        <div className="bg-white p-2 rounded">
          <div className="text-xs text-gray-500">ROI</div>
          <div className={`font-bold ${roiColor}`}>${model.roi.toFixed(2)}</div>
        </div>
      </div>

      {/* Channel Contribution Chart */}
      <div>
        <h5 className="font-medium text-gray-800 mb-2 text-sm">Channel Contribution</h5>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={model.details} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={35} stroke={chartColors.text} fontSize={10} interval={0} />
            <Tooltip wrapperClassName="glass-pane" cursor={{ fill: 'rgba(0,0,0, 0.05)' }} formatter={(value: number) => `${value.toFixed(1)}%`}/>
            <Bar dataKey="contribution" name="Contribution" stackId="a">
              {model.details.map((p, idx) => (
                <Cell key={`cell-${idx}`} fill={p.included ? (p.pValue != null && p.pValue > 0.1 ? '#f87171' : '#32A29B') : '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Diagnostics Summary */}
      <div>
        <h5 className="font-medium text-gray-800 mb-2 text-sm">Diagnostics</h5>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Warnings:</span>
            <span className={model.diagnostics && model.diagnostics.warning_count > 0 ? 'text-yellow-600 font-medium' : 'text-green-600'}>
              {model.diagnostics && model.diagnostics.warning_count > 0 ? `⚠️ ${model.diagnostics.warning_count}` : '✓ Clean'}
            </span>
          </div>
          {model.diagnostics && model.diagnostics.weak_channels && model.diagnostics.weak_channels.length > 0 && (
            <div className="text-yellow-600">
              Weak: {model.diagnostics.weak_channels.slice(0, 2).join(', ')}
              {model.diagnostics.weak_channels.length > 2 && ` +${model.diagnostics.weak_channels.length - 2}`}
            </div>
          )}
          {model.diagnostics && model.diagnostics.sign_mismatch && model.diagnostics.sign_mismatch.length > 0 && (
            <div className="text-red-600">
              Sign issues: {model.diagnostics.sign_mismatch.slice(0, 2).join(', ')}
            </div>
          )}
          {model.diagnostics && model.diagnostics.overfit_risk && (
            <div className="text-orange-600">Overfit risk detected</div>
          )}
        </div>
      </div>

      {/* Key Parameters */}
      <div>
        <h5 className="font-medium text-gray-800 mb-2 text-sm">Key Parameters</h5>
        <div className="space-y-1">
          {model.details.slice(0, 3).map(detail => (
            <div key={detail.name} className="flex justify-between items-center text-xs">
              <span className="font-medium">{detail.name}</span>
              <div className="flex space-x-1">
                <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded">a={detail.adstock.toFixed(2)}</span>
                <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded">L={detail.lag}</span>
              </div>
            </div>
          ))}
          {model.details.length > 3 && (
            <div className="text-xs text-gray-500">+{model.details.length - 3} more channels</div>
          )}
        </div>
      </div>
    </div>
  );
};

const generateComparisonInsights = (models: ModelRun[]): string[] => {
  const insights = [];
  
  // Performance comparison
  const sortedByRsq = [...models].sort((a, b) => b.rsq - a.rsq);
  const sortedByRoi = [...models].sort((a, b) => b.roi - a.roi);
  
  insights.push(`Performance leader: ${sortedByRsq[0].id} shows highest R² (${(sortedByRsq[0].rsq * 100).toFixed(1)}%), while ${sortedByRoi[0].id} delivers best ROI (${sortedByRoi[0].roi.toFixed(2)}x).`);
  
  // Algorithm differences
  const algos = models.map(m => m.algo.replace(' Regression', ''));
  if (new Set(algos).size > 1) {
    insights.push(`Algorithm comparison: ${algos.join(' vs ')} demonstrate different modeling approaches with varying complexity-accuracy tradeoffs.`);
  }
  
  // Diagnostic comparison
  const warningCounts = models.map(m => m.diagnostics?.warning_count || 0);
  const cleanModels = models.filter(m => m.diagnostics && m.diagnostics.warning_count === 0);
  
  if (cleanModels.length > 0) {
    insights.push(`Statistical reliability: ${cleanModels.map(m => m.id).join(', ')} show${cleanModels.length === 1 ? 's' : ''} clean diagnostics with no statistical warnings.`);
  } else {
    const minWarnings = Math.min(...warningCounts);
    const bestDiagModel = models.find(m => m.diagnostics && m.diagnostics.warning_count === minWarnings);
    insights.push(`Diagnostic quality: ${bestDiagModel?.id} has fewest warnings (${minWarnings}), suggesting better statistical foundation.`);
  }
  
  return insights;
};

export const ModelCompare: React.FC<ModelCompareProps> = ({ models, onClose }) => {
  const insights = generateComparisonInsights(models);
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Model Comparison</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* AI Comparison Insights */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">AI Comparison Analysis</h3>
            <div className="space-y-2">
              {insights.map((insight, idx) => (
                <p key={idx} className="text-sm text-blue-800">{insight}</p>
              ))}
            </div>
          </div>
          
          {/* Side-by-side Model Cards */}
          <div className="flex gap-4">
            {models.map((model, index) => (
              <ComparisonCard key={model.id} model={model} index={index} />
            ))}
          </div>
          
          {/* Detailed Parameter Comparison Table */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Detailed Parameter Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 border-r border-gray-200">Channel</th>
                    {models.map((model, idx) => (
                      <th key={model.id} className={`p-3 text-center ${idx < models.length - 1 ? 'border-r border-gray-200' : ''}`}>
                        {model.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {models[0].details.map((detail) => (
                    <tr key={detail.name} className="border-t border-gray-100">
                      <td className="p-3 font-medium border-r border-gray-200">{detail.name}</td>
                      {models.map((model, idx) => {
                        const modelDetail = model.details.find(d => d.name === detail.name);
                        return (
                          <td key={model.id} className={`p-3 text-center ${idx < models.length - 1 ? 'border-r border-gray-200' : ''}`}>
                            {modelDetail ? (
                              <div className="space-y-1">
                                <div className="flex justify-center space-x-1">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    a={modelDetail.adstock.toFixed(2)}
                                  </span>
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                    L={modelDetail.lag}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {modelDetail.transform.replace('-transform', '')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};