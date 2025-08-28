import React, { useState, useMemo } from 'react';
import { ModelRun } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot } from 'recharts';
import { selectReportView, createReportDataStores } from '../services/reportSelectors';

interface EnhancedFinalReportProps {
    activeModelId: string | null;
    models: ModelRun[];
    selectedChannels: string[];
    onGoToOptimizer: (modelId: string, curveParams: any, operatingSpends: any) => void;
    onRecalibrate?: () => void;
}

const chartColors = {
    line: 'var(--color-teal)', 
    grid: 'rgba(26, 22, 40, 0.1)',
    text: '#1A1628'
};

// Custom tooltip for enhanced response curves
const ResponseCurveTooltip: React.FC<any> = ({ active, payload, label, operatingPoint, blendedROI }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0];
  const isOperatingPoint = Math.abs(label - operatingPoint.spend) < 0.1;
  
  return (
    <div className="glass-pane p-3 text-sm">
      <div className="font-medium mb-2">
        {isOperatingPoint ? 'Operating Point' : 'Response Curve'}
      </div>
      <div className="space-y-1">
        <div>Spend: ${label.toFixed(1)}M</div>
        <div>Predicted KPI: {data.value?.toFixed(0)}</div>
        {isOperatingPoint && (
          <>
            <div>Elasticity ε(x): {operatingPoint.elasticity.toFixed(3)}</div>
            <div>mROI(x): ${operatingPoint.mROI.toFixed(2)}</div>
            {operatingPoint.mROI > blendedROI && (
              <div className="text-green-600 text-xs mt-1">⬆ Above blended ROI</div>
            )}
            {operatingPoint.mROI > 1 && operatingPoint.mROI <= blendedROI && (
              <div className="text-orange-600 text-xs mt-1">✓ Profitable</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Reliability indicator for curves
const ReliabilityIndicator: React.FC<{ channel: string; diagnostics: any; modelAlgo: string }> = ({ 
  channel, diagnostics, modelAlgo 
}) => {
  const diagnostic = diagnostics?.diagnostics?.find((d: any) => d.channel === channel);
  if (!diagnostic) return null;
  
  const isStatistical = modelAlgo.includes('Regression') || modelAlgo.includes('Bayesian') || modelAlgo.includes('GLM');
  let isReliable = true;
  let reason = '';
  
  if (isStatistical) {
    const hasNegativeCoeff = (diagnostic.coefficient || 0) <= 0;
    const hasHighPValue = diagnostic.pValue && diagnostic.pValue >= 0.05;
    const ciCrossesZero = diagnostic.confidence_interval && 
                         diagnostic.confidence_interval[0] <= 0 && 
                         diagnostic.confidence_interval[1] >= 0;
    
    if (hasNegativeCoeff) {
      isReliable = false;
      reason = 'Negative coefficient';
    } else if (hasHighPValue && ciCrossesZero) {
      isReliable = false;
      reason = 'Not statistically significant';
    }
  } else {
    // Tree/NN models
    if ((diagnostic.importance || 0) <= 0) {
      isReliable = false;
      reason = 'Non-positive SHAP importance';
    }
  }
  
  if (!isReliable) {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded ml-2" title={reason}>
        Not reliable
      </span>
    );
  }
  
  return null;
};

export const EnhancedFinalReport: React.FC<EnhancedFinalReportProps> = ({ 
  activeModelId, 
  models, 
  selectedChannels, 
  onGoToOptimizer, 
  onRecalibrate 
}) => {
    const [showROIShading, setShowROIShading] = useState(false);
    
    // Use strict report view selector
    const reportView = useMemo(() => {
        const { modelById, contributionsById, diagnosticsById, responseCurvesById, metricsById } = 
            createReportDataStores(models);
        return selectReportView(
            activeModelId, 
            selectedChannels, 
            modelById, 
            contributionsById, 
            diagnosticsById, 
            responseCurvesById, 
            metricsById
        );
    }, [activeModelId, models, selectedChannels]);
    
    // Handle no active model
    if (!activeModelId) {
        return (
            <div className="p-8 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Model Selected</h3>
                <p className="text-gray-600">Please go back to the Modeling tab and select a model to generate the report.</p>
            </div>
        );
    }
    
    // Handle consistency issues
    if (!reportView.consistent) {
        return (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
                <div className="glass-pane p-8 text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Selections Changed</h3>
                    <p className="text-gray-600 mb-2">Recalibration required.</p>
                    <p className="text-sm text-gray-500 mb-6">{reportView.inconsistencyReason}</p>
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
    
    const { model, metrics, attribution, curves, diagnostics } = reportView;
    
    if (!model || !metrics || !attribution || !curves || !diagnostics) {
        return <p className="p-8 text-center">Data loading error. Please try again.</p>;
    }

    const includedChannels = model.details.filter(p => p.included);
    const includedCurves = curves.curves.filter(c => 
        includedChannels.some(ch => ch.name === c.channel)
    );
    
    // Use strict report data from selectors
    const totalSpend = metrics.totalSpend;
    const totalImpact = metrics.totalImpact;
    const baseImpact = metrics.baseImpact;
    const marketingImpact = metrics.marketingImpact;
    const basePercentage = (baseImpact / totalImpact) * 100;
    const marketingPercentage = (marketingImpact / totalImpact) * 100;
    
    // Calculate normalized contributions
    const rawTotalContribution = includedChannels.reduce((sum, p) => sum + p.contribution, 0);
    const contributionScale = marketingPercentage / rawTotalContribution;
    
    const reportData = includedChannels.map(p => {
        const curveData = includedCurves.find(c => c.channel === p.name);
        const scaledContribution = p.contribution * contributionScale;
        const attributedKPI = (scaledContribution / 100) * totalImpact;
        const impactPercentage = scaledContribution;
        const avgROI = p.roi;
        // Use operating point mROI if available
        const mROI = curveData?.operatingPoint.mROI || (avgROI * (1 - p.adstock) * 0.8);
        
        return { 
            name: p.name, 
            spend: curveData?.operatingPoint.spend || 0,
            attributedKPI, 
            impactPercentage, 
            avgROI, 
            mROI 
        };
    });
    
    const blendedROI = metrics.blendedROI;
    const blendedRoiColor = blendedROI < 0 ? 'text-red-600' : 'text-green-600';
    
    // Prepare data for optimizer handoff
    const handleProceedToOptimizer = () => {
        const curveParams = includedCurves.map(curve => ({
            channel: curve.channel,
            params: curve.params,
            operatingPoint: curve.operatingPoint
        }));
        
        const operatingSpends = includedCurves.reduce((acc, curve) => {
            acc[curve.channel] = curve.operatingPoint.spend;
            return acc;
        }, {} as Record<string, number>);
        
        onGoToOptimizer(activeModelId, curveParams, operatingSpends);
    };
    
    const handleExport = () => {
        let textContent = `MMM Final Report - Model ID: ${model.id} (${model.algo})\n`;
        textContent += `===================================================\n\n`;
        
        textContent += `KEY METRICS\n`;
        textContent += `--------------------------\n`;
        textContent += `R-Square: ${model.rsq.toFixed(2)}\n`;
        textContent += `MAPE: ${model.mape.toFixed(1)}%\n`;
        textContent += `Total Spend: $${totalSpend.toFixed(1)}M\n`;
        textContent += `Blended ROI: $${blendedROI.toFixed(2)}\n\n`;

        textContent += `PERFORMANCE SUMMARY\n`;
        textContent += `------------------------------------------------------------------------------------------------------------\n`;
        textContent += `| Channel                   | Spend      | Attributed KPI | Impact %   | Avg. ROI   | Marginal ROI | Operating ε |\n`;
        textContent += `------------------------------------------------------------------------------------------------------------\n`;
        
        reportData.forEach(d => {
            const curveData = includedCurves.find(c => c.channel === d.name);
            const elasticity = curveData?.operatingPoint.elasticity?.toFixed(3) || 'N/A';
            textContent += `| ${d.name.padEnd(25)} | $${d.spend.toFixed(1).padStart(7)}M | ${d.attributedKPI.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(14)} | ${d.impactPercentage.toFixed(1).padStart(8)}% | $${d.avgROI.toFixed(2).padStart(8)} | $${d.mROI.toFixed(2).padStart(10)} | ${String(elasticity).padStart(11)} |\n`;
        });
        
        const baseImpactPercent = basePercentage.toFixed(1);
        textContent += `| Base Sales / Intercept    | -          | ${baseImpact.toLocaleString().padStart(14)} | ${baseImpactPercent.padStart(8)}% | -          | -            | -           |\n`;
        textContent += `------------------------------------------------------------------------------------------------------------\n\n`;
        
        textContent += `RESPONSE CURVE PARAMETERS\n`;
        textContent += `---------------------------\n`;
        includedCurves.forEach(curve => {
            textContent += `- ${curve.channel}: ${curve.params.transform} (a=${curve.params.adstock.toFixed(2)}, lag=${curve.params.lag})\n`;
            textContent += `  Operating: $${curve.operatingPoint.spend.toFixed(1)}M → ${curve.operatingPoint.response.toFixed(0)} (ε=${curve.operatingPoint.elasticity.toFixed(3)}, mROI=$${curve.operatingPoint.mROI.toFixed(2)})\n`;
        });
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MMx-Report-${model.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="glass-pane p-6">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h2 className="text-2xl font-bold">MMx Final Report</h2>
                        <p className="text-sm text-gray-500">Generated from Active Model ID: <strong>{model.id} ({model.algo})</strong></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleExport} className="secondary-button">
                           Export Report
                        </button>
                        <button onClick={handleProceedToOptimizer} className="primary-button">
                            Proceed to Optimizer
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8 text-center">
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">R-Square</div>
                        <div className="text-3xl font-bold">{model.rsq.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">MAPE</div>
                        <div className="text-3xl font-bold">{model.mape.toFixed(1)}%</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Total Spend</div>
                        <div className="text-3xl font-bold">${totalSpend.toFixed(1)}M</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm text-gray-500">Blended ROI</div>
                        <div className={`text-3xl font-bold ${blendedRoiColor}`}>${blendedROI.toFixed(2)}</div>
                    </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Performance Summary</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3">Channel</th>
                                <th className="p-3">Spend</th>
                                <th className="p-3">Attributed KPI</th>
                                <th className="p-3">Impact %</th>
                                <th className="p-3">Avg. ROI</th>
                                <th className="p-3">Marginal ROI (mROI)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(d => (
                                <tr key={d.name} className="border-b border-gray-200">
                                    <td className="p-3 font-semibold">{d.name}</td>
                                    <td className="p-3">${d.spend.toFixed(1)}M</td>
                                    <td className="p-3">{d.attributedKPI.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="p-3">{d.impactPercentage.toFixed(1)}%</td>
                                    <td className={`p-3 font-bold ${d.avgROI < 0 ? 'text-red-600' : 'text-green-600'}`}>${d.avgROI.toFixed(2)}</td>
                                    <td className={`p-3 font-bold ${d.mROI < 0 ? 'text-red-600' : 'text-green-600'}`}>${d.mROI.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <td className="p-3 font-semibold">Base Sales / Intercept</td>
                                <td>-</td>
                                <td>{baseImpact.toLocaleString()}</td>
                                <td>{basePercentage.toFixed(1)}%</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Response Curves with Operating Points</h3>
                        <div className="flex items-center space-x-2">
                            <label className="flex items-center text-sm">
                                <input
                                    type="checkbox"
                                    checked={showROIShading}
                                    onChange={(e) => setShowROIShading(e.target.checked)}
                                    className="mr-2"
                                />
                                Highlight mROI &gt; blended ROI
                            </label>
                        </div>
                    </div>
                    <p className="text-gray-600 mb-4 text-sm">Operating points show current spend levels with elasticity and marginal ROI. Curves display diminishing returns based on model parameters.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {includedCurves.map(curve => {
                            const channel = includedChannels.find(c => c.name === curve.channel);
                            const chartData = curve.points.map(p => ({ x: p.spend, y: p.response }));
                            const { operatingPoint } = curve;
                            
                            return (
                                <div key={curve.channel} className="bg-gray-100 p-4 rounded-lg">
                                    <div className="flex items-center justify-center mb-2">
                                        <h5 className="font-semibold text-gray-800">
                                            {curve.channel}
                                        </h5>
                                        <span className="text-xs font-normal text-gray-500 ml-2">
                                            ({curve.params.transform})
                                        </span>
                                        <ReliabilityIndicator 
                                            channel={curve.channel} 
                                            diagnostics={diagnostics}
                                            modelAlgo={model.algo}
                                        />
                                    </div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={chartData}>
                                            <XAxis 
                                                type="number" 
                                                dataKey="x" 
                                                name="Spend" 
                                                stroke={chartColors.text} 
                                                tick={{ fontSize: 10 }} 
                                                tickFormatter={(value) => `$${value}M`}
                                            />
                                            <YAxis 
                                                stroke={chartColors.text} 
                                                tick={{ fontSize: 10 }} 
                                                domain={[0, 'dataMax']}
                                                tickFormatter={(value) => value.toLocaleString()}
                                            />
                                            <Tooltip 
                                                content={<ResponseCurveTooltip 
                                                    operatingPoint={operatingPoint}
                                                    blendedROI={blendedROI}
                                                />}
                                            />
                                            
                                            {/* Operating point vertical guide */}
                                            <ReferenceLine 
                                                x={operatingPoint.spend} 
                                                stroke="#6B7280" 
                                                strokeDasharray="3 3" 
                                                strokeWidth={1}
                                            />
                                            
                                            {/* Response curve */}
                                            <Line 
                                                type="monotone" 
                                                dataKey="y" 
                                                name="Response" 
                                                stroke={chartColors.line} 
                                                strokeWidth={2} 
                                                dot={false}
                                            />
                                            
                                            {/* Operating point dot */}
                                            <Line 
                                                type="monotone" 
                                                dataKey="y" 
                                                stroke="none" 
                                                dot={(props) => {
                                                    if (Math.abs(props.payload.x - operatingPoint.spend) < 0.5) {
                                                        return (
                                                            <Dot 
                                                                {...props} 
                                                                r={6} 
                                                                fill={operatingPoint.mROI > blendedROI ? '#10B981' : '#F59E0B'}
                                                                stroke="white"
                                                                strokeWidth={2}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    
                                    {/* Operating point summary */}
                                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Operating Spend:</span>
                                            <span className="font-mono">${operatingPoint.spend.toFixed(1)}M</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Elasticity ε(x):</span>
                                            <span className="font-mono">{operatingPoint.elasticity.toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>mROI(x):</span>
                                            <span className={`font-mono ${
                                                operatingPoint.mROI > blendedROI ? 'text-green-600' : 
                                                operatingPoint.mROI > 1 ? 'text-orange-600' : 'text-red-600'
                                            }`}>
                                                ${operatingPoint.mROI.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};