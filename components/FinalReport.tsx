import React from 'react';
import { ModelRun, ModelDetail } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface FinalReportProps {
    model: ModelRun | null;
    onGoToOptimizer: () => void;
}

const chartColors = {
  line: 'var(--color-teal)', 
  grid: 'rgba(26, 22, 40, 0.1)',
  text: '#1A1628'
}

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
}


export const FinalReport: React.FC<FinalReportProps> = ({ model, onGoToOptimizer }) => {
    if (!model) {
        return <p className="p-8 text-center">No model finalized. Please go back and calibrate a model.</p>;
    }

    const includedChannels = model.details.filter(p => p.included);
    const totalSpend = includedChannels.reduce((sum, p) => sum + (p.adstock * 500 + p.lag * 100), 1000); // Simulated
    const totalImpact = includedChannels.reduce((sum, p) => sum + p.contribution, 0) * 1000;
    const baseImpact = 85000;
    const grandTotalImpact = totalImpact + baseImpact;

    const reportData = includedChannels.map(p => {
        const spend = (p.adstock * 500 + p.lag * 100) + Math.random() * 20; // Simulated
        const attributedKPI = p.contribution / 100 * totalImpact;
        const impactPercentage = (attributedKPI / grandTotalImpact) * 100;
        const avgROI = p.roi;
        const mROI = avgROI * (1 - p.adstock) * 0.8;
        return { name: p.name, spend, attributedKPI, impactPercentage, avgROI, mROI };
    });

    const blendedRoiColor = model.roi < 0 ? 'text-red-600' : 'text-green-600';
    
    const handleExport = () => {
        let textContent = `MMM Final Report - Model ID: ${model.id} (${model.algo})\n`;
        textContent += `===================================================\n\n`;
        
        textContent += `KEY METRICS\n`;
        textContent += `--------------------------\n`;
        textContent += `R-Square: ${model.rsq.toFixed(2)}\n`;
        textContent += `MAPE: ${model.mape.toFixed(1)}%\n`;
        textContent += `Total Spend: $${(totalSpend / 10).toFixed(1)}M\n`;
        textContent += `Blended ROI: $${model.roi.toFixed(2)}\n\n`;

        textContent += `PERFORMANCE SUMMARY\n`;
        textContent += `--------------------------------------------------------------------------------------------------\n`;
        textContent += `| Channel                   | Spend      | Attributed KPI | Impact %   | Avg. ROI   | Marginal ROI |\n`;
        textContent += `--------------------------------------------------------------------------------------------------\n`;
        reportData.forEach(d => {
            textContent += `| ${d.name.padEnd(25)} | $${d.spend.toFixed(1).padStart(7)}M | ${d.attributedKPI.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(14)} | ${d.impactPercentage.toFixed(1).padStart(8)}% | $${d.avgROI.toFixed(2).padStart(8)} | $${d.mROI.toFixed(2).padStart(10)} |\n`;
        });
         const baseImpactPercent = ((baseImpact / grandTotalImpact) * 100).toFixed(1);
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
                        <p className="text-sm text-gray-500">Generated from Calibrated Model ID: <strong>{model.id} ({model.algo})</strong></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleExport} className="secondary-button">
                           Export Report
                        </button>
                        <button onClick={onGoToOptimizer} className="primary-button">
                            Proceed to Optimizer
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8 text-center">
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">R-Square</div><div className="text-3xl font-bold">{model.rsq.toFixed(2)}</div></div>
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">MAPE</div><div className="text-3xl font-bold">{model.mape.toFixed(1)}%</div></div>
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">Total Spend</div><div className="text-3xl font-bold">${(totalSpend/10).toFixed(1)}M</div></div>
                    <div className="bg-gray-100 p-3 rounded-lg"><div className="text-sm text-gray-500">Blended ROI</div><div className={`text-3xl font-bold ${blendedRoiColor}`}>${model.roi.toFixed(2)}</div></div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Performance Summary</h3>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                    <thead className="bg-gray-100"><tr><th className="p-3">Channel</th><th className="p-3">Spend</th><th className="p-3">Attributed KPI</th><th className="p-3">Impact %</th><th className="p-3">Avg. ROI</th><th className="p-3">Marginal ROI (mROI)</th></tr></thead>
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
                            <td>{((baseImpact / grandTotalImpact) * 100).toFixed(1)}%</td>
                            <td>-</td><td>-</td>
                        </tr>
                    </tbody>
                </table></div>
                
                <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Response Curves</h3>
                 <p className="text-gray-600 mb-4 text-sm">These curves show the estimated diminishing returns for each channel based on its transformation setting in the final model.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {includedChannels.map(p => {
                        const chartData = generateResponseCurve(p, totalImpact);
                        return (
                            <div key={p.name} className="bg-gray-100 p-4 rounded-lg">
                                <h5 className="font-semibold text-center mb-2 text-gray-800">{p.name} <span className="text-xs font-normal text-gray-500">({p.transform})</span></h5>
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