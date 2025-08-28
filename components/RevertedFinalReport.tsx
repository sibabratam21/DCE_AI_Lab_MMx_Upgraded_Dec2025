import React, { useState, useMemo } from 'react';
import { ModelRun, ModelDetail } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { selectScopedReportView } from '../services/scopedReportSelectors';
import { getCurrentDataset } from '../services/datasetStore';
import { getConsistentChannelSpend } from '../services/demoSimulation';

interface RevertedFinalReportProps {
    activeModelId: string | null;
    models: ModelRun[];
    selectedChannels: string[];
    onGoToOptimizer: (modelId?: string) => void;
    onRecalibrate?: () => void;
}

const chartColors = {
    line: 'var(--color-teal)', 
    grid: 'rgba(26, 22, 40, 0.1)',
    text: '#1A1628'
};

// Original response curve generation without operating points
const generateResponseCurve = (channel: ModelDetail, totalImpact: number) => {
    const spendLevels = Array.from({ length: 21 }, (_, i) => i * 8); // Spend from 0 to 160
    const maxResponse = (channel.contribution / 100 * totalImpact) * 1.5;
    let responseValues;

    switch (channel.transform) {
        case 'S-Curve': {
            const steepness = 5; // Controls how quickly it rises
            const midpoint = 60; // Spend level where curve is steepest
            responseValues = spendLevels.map(spend => maxResponse / (1 + Math.exp(-steepness * (spend - midpoint) / 100)));
            break;
        }
        case 'Power': {
            // y = a * x^b where b is between 0 and 1 for diminishing returns
            const exponent = 1 - channel.adstock * 0.8; // e.g. adstock 0.5 -> exponent 0.6
            const scale = maxResponse / Math.pow(160, exponent);
            responseValues = spendLevels.map(spend => scale * Math.pow(spend, exponent));
            break;
        }
        case 'Log-transform': {
            const scale = maxResponse / Math.log(161); // Add 1 to avoid log(0)
            responseValues = spendLevels.map(spend => scale * Math.log(spend + 1));
            break;
        }
        case 'Negative Exponential':
        default: {
            const steepness = (1.1 - channel.adstock) * 3;
            responseValues = spendLevels.map(spend => maxResponse * (1 - Math.exp(-steepness * spend / 100)));
            break;
        }
    }
    return spendLevels.map((s, i) => ({ x: s, y: responseValues[i] || 0 }));
};

export const RevertedFinalReport: React.FC<RevertedFinalReportProps> = ({ 
  activeModelId, 
  models, 
  selectedChannels, 
  onGoToOptimizer, 
  onRecalibrate 
}) => {
    // Simplified report view without complex scoped selectors 
    const reportView = useMemo(() => {
        const model = models.find(m => m.id === activeModelId);
        
        if (!model) {
            return {
                model: null,
                dataTotals: { totalKPI: 50000 }, // Default KPI
                modelContributions: {},
                consistent: false,
                inconsistencyReason: 'No model found'
            };
        }

        // Check channel consistency
        const modelChannels = new Set(model.channels || model.details.map(d => d.name));
        const selectedChannelsSet = new Set(selectedChannels);
        const isConsistent = modelChannels.size === selectedChannelsSet.size && 
                             [...modelChannels].every(x => selectedChannelsSet.has(x));

        if (!isConsistent) {
            return {
                model,
                dataTotals: { totalKPI: 50000 },
                modelContributions: {},
                consistent: false,
                inconsistencyReason: `Channel mismatch. Model: [${Array.from(modelChannels).join(', ')}], Selected: [${selectedChannels.join(', ')}]`
            };
        }

        // Create model contributions based on channel details
        const modelContributions: Record<string, number> = {};
        const totalKPI = 50000; // Use a reasonable default KPI value
        
        model.details.forEach(detail => {
            if (detail.included) {
                modelContributions[detail.name] = (detail.contribution / 100) * totalKPI;
            }
        });

        return {
            model,
            dataTotals: { totalKPI },
            modelContributions,
            consistent: true
        };
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
    
    // Handle consistency issues - STRICT channel equality enforcement
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
    
    const { model, dataTotals, modelContributions, reconciliation } = reportView;
    
    if (!model || !dataTotals) {
        return <p className="p-8 text-center">Data loading error. Please try again.</p>;
    }

    const includedChannels = model.details.filter(p => p.included);
    
    // Use total spend from consistent calculation (not from scoped data)
    const totalSpend = includedChannels.reduce((sum, p) => sum + getConsistentChannelSpend(p.name), 0);
    const totalKPI = dataTotals?.totalKPI || 50000; // Fallback if data totals unavailable
    
    // Calculate marketing impact from model contributions
    const totalMarketingImpact = Object.values(modelContributions).reduce((sum, contrib) => sum + contrib, 0);
    const baseImpact = totalKPI - totalMarketingImpact;
    const basePercentage = (baseImpact / totalKPI) * 100;
    const marketingPercentage = (totalMarketingImpact / totalKPI) * 100;
    
    // Calculate normalized contributions (original approach)
    const rawTotalContribution = includedChannels.reduce((sum, p) => sum + p.contribution, 0);
    const contributionScale = marketingPercentage / rawTotalContribution;
    
    // Add revenue conversion constant
    const KPI_TO_REVENUE_MULTIPLIER = 1000; // $1000 per KPI unit (e.g., per prescription)
    const totalRevenue = totalKPI * KPI_TO_REVENUE_MULTIPLIER;
    
    const reportData = includedChannels.map(p => {
        const attributedKPI = modelContributions[p.name] || 0;
        const impactPercentage = (attributedKPI / totalKPI) * 100;
        const avgROI = p.roi;
        // Original marginal ROI calculation
        const mROI = avgROI * (1 - p.adstock) * 0.8;
        // Use consistent spend calculation method
        const spend = getConsistentChannelSpend(p.name) / 1000000; // Convert to millions
        
        return { 
            name: p.name, 
            spend,
            attributedKPI, 
            impactPercentage, 
            avgROI, 
            mROI 
        };
    });
    
    // Calculate blended ROI as weighted average of channel ROIs
    const totalChannelSpend = reportData.reduce((sum, d) => sum + d.spend * 1000000, 0); // Convert back to dollars
    const blendedROI = totalChannelSpend > 0 
        ? reportData.reduce((sum, d) => sum + (d.avgROI * (d.spend * 1000000)), 0) / totalChannelSpend
        : 0;
    const blendedRoiColor = blendedROI < 0 ? 'text-red-600' : 'text-green-600';
    
    const handleProceedToOptimizer = () => {
        onGoToOptimizer(activeModelId);
    };
    
    const handleExport = () => {
        let textContent = `MMM Final Report - Model ID: ${model.id} (${model.algo})\n`;
        textContent += `===================================================\n\n`;
        
        textContent += `KEY METRICS\n`;
        textContent += `--------------------------\n`;
        textContent += `R-Square: ${model.rsq.toFixed(2)}\n`;
        textContent += `MAPE: ${model.mape.toFixed(1)}%\n`;
        textContent += `Total Spend: $${(totalSpend / 1000000).toFixed(1)}M\n`;
        textContent += `Blended ROI: $${blendedROI.toFixed(2)}\n\n`;

        textContent += `PERFORMANCE SUMMARY\n`;
        textContent += `--------------------------------------------------------------------------------------------------\n`;
        textContent += `| Channel                   | Spend      | Attributed KPI | Impact %   | Avg. ROI   | Marginal ROI |\n`;
        textContent += `--------------------------------------------------------------------------------------------------\n`;
        
        reportData.forEach(d => {
            textContent += `| ${d.name.padEnd(25)} | $${d.spend.toFixed(1).padStart(7)}M | ${d.attributedKPI.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(14)} | ${d.impactPercentage.toFixed(1).padStart(8)}% | $${d.avgROI.toFixed(2).padStart(8)} | $${d.mROI.toFixed(2).padStart(10)} |\n`;
        });
        
        const baseImpactPercent = basePercentage.toFixed(1);
        textContent += `| Base Sales / Intercept    | -          | ${baseImpact.toLocaleString().padStart(14)} | ${baseImpactPercent.padStart(8)}% | -          | -            |\n`;
        textContent += `--------------------------------------------------------------------------------------------------\n\n`;
        
        textContent += `RESPONSE CURVE TRANSFORMS\n`;
        textContent += `--------------------------\n`;
        includedChannels.forEach(p => {
            textContent += `- ${p.name}: ${p.transform}\n`;
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
                        <div className="text-3xl font-bold">${(totalSpend / 1000000).toFixed(0)}M</div>
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
                
                <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Response Curves</h3>
                <p className="text-gray-600 mb-4 text-sm">These curves show the estimated diminishing returns for each channel based on its transformation setting in the final model.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {includedChannels.map(p => {
                        const chartData = generateResponseCurve(p, totalMarketingImpact);
                        return (
                            <div key={p.name} className="bg-gray-100 p-4 rounded-lg">
                                <h5 className="font-semibold text-center mb-2 text-gray-800">
                                    {p.name} <span className="text-xs font-normal text-gray-500">({p.transform})</span>
                                </h5>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={chartData}>
                                        <XAxis type="number" dataKey="x" name="Spend" stroke={chartColors.text} tick={{ fontSize: 10 }} unit="k" />
                                        <YAxis stroke={chartColors.text} tick={{ fontSize: 10 }} domain={[0, 'dataMax']} />
                                        <Tooltip wrapperClassName="glass-pane"/>
                                        <Line type="monotone" dataKey="y" name="Response" stroke={chartColors.line} strokeWidth={2} dot={false}/>
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};