import React from 'react';
import { ModelRun, OptimizerScenario } from '../types';

interface OptimizerProps {
    model: ModelRun | null;
    scenarios: OptimizerScenario[];
    activeScenarioId: string;
    onSelectScenario: (id: string) => void;
}

const ScenarioDetail: React.FC<{ scenario: OptimizerScenario, modelId: string }> = ({ scenario, modelId }) => {
    
    const handleExport = () => {
        let textContent = `Budget Optimization Scenario: "${scenario.title}"\n`;
        textContent += `Based on MMx Model ID: ${modelId}\n`;
        textContent += `===================================================\n\n`;
        
        textContent += `SCENARIO METRICS\n`;
        textContent += `--------------------------\n`;
        textContent += `Recommended Spend: $${scenario.recommendedSpend.toFixed(1)}M\n`;
        textContent += `Projected ROI: $${scenario.projectedROI.toFixed(2)}\n`;
        textContent += `Net Revenue: $${scenario.netRevenue.toFixed(1)}M\n\n`;

        textContent += `CHANNEL ALLOCATION\n`;
        textContent += `------------------------------------------------------------------------------------------------------------------------------\n`;
        textContent += `| Channel                   | Current Spend  | Rec. Spend     | Change    | Proj. ROI  | Agent Commentary\n`;
        textContent += `------------------------------------------------------------------------------------------------------------------------------\n`;
        scenario.channels.forEach(ch => {
            const changeStr = (ch.change >= 0 ? '+' : '') + ch.change.toFixed(0) + '%';
            textContent += `| ${ch.name.padEnd(25)} | $${ch.currentSpend.toFixed(1).padStart(12)}M | $${ch.recommendedSpend.toFixed(1).padStart(12)}M | ${changeStr.padStart(9)} | $${ch.projectedROI.toFixed(2).padStart(8)} | ${ch.agentCommentary}\n`;
        });
        textContent += `------------------------------------------------------------------------------------------------------------------------------\n`;

        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Optimizer-Scenario-${scenario.id.replace(/:|\s/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-fade-in flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center w-full">
                    <div className="bg-gray-100 p-4 rounded-lg"><div className="text-sm text-gray-500">Recommended Spend</div><div className="text-3xl font-bold">${scenario.recommendedSpend.toFixed(1)}M</div></div>
                    <div className="bg-gray-100 p-4 rounded-lg"><div className="text-sm text-gray-500">Projected ROI</div><div className={`text-3xl font-bold ${scenario.projectedROI < 0 ? 'text-red-600' : 'text-green-600'}`}>${scenario.projectedROI.toFixed(2)}</div></div>
                    <div className="bg-gray-100 p-4 rounded-lg"><div className="text-sm text-gray-500">Net Revenue</div><div className={`text-3xl font-bold ${scenario.netRevenue < 0 ? 'text-red-600' : 'text-green-600'}`}>${scenario.netRevenue.toFixed(1)}M</div></div>
                </div>
            </div>
             <div className="flex justify-end mb-4">
                <button onClick={handleExport} className="secondary-button">
                    Export Scenario
                </button>
            </div>
            <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100"><tr><th className="p-3">Channel</th><th className="p-3">Current Spend</th><th className="p-3">Recommended Spend</th><th className="p-3">Change</th><th className="p-3">Projected ROI</th><th className="p-3 w-1/3">Agent Commentary</th></tr></thead>
                    <tbody>
                        {scenario.channels.map(channel => {
                            const changeColor = channel.change >= 0 ? 'text-green-600' : 'text-red-600';
                            const roiColor = channel.projectedROI < 0 ? 'text-red-600' : 'text-green-600';
                            return (
                                <tr key={channel.name} className="border-b border-gray-200">
                                    <td className="p-3 font-semibold">{channel.name}</td>
                                    <td className="p-3">${channel.currentSpend.toFixed(1)}M</td>
                                    <td className="p-3 font-bold">${channel.recommendedSpend.toFixed(1)}M</td>
                                    <td className={`p-3 font-bold ${changeColor}`}>{channel.change >= 0 ? '+' : ''}{channel.change.toFixed(0)}%</td>
                                    <td className={`p-3 font-bold ${roiColor}`}>${channel.projectedROI.toFixed(2)}</td>
                                    <td className="p-3 text-gray-500 text-xs italic">{channel.agentCommentary}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


export const Optimizer: React.FC<OptimizerProps> = ({ model, scenarios, activeScenarioId, onSelectScenario }) => {

    if (!model || scenarios.length === 0) {
        return <p className="p-8 text-center">No optimization scenarios available. Please finalize a model first.</p>;
    }
    
    const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

    return (
        <div className="p-4 md:p-6 max-w-full mx-auto h-full">
            <div className="glass-pane p-6 h-full flex flex-col">
                 <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Budget Optimization Scenarios</h2>
                    <p className="text-gray-600">Based on your finalized model (<strong>{model.id}</strong>), here are several budget allocation scenarios. Ask the agent to create new ones based on your goals.</p>
                 </div>

                 <div className="flex-grow flex gap-8 overflow-hidden">
                    {/* Scenario List */}
                    <nav className="w-1/3 md:w-1/4 flex-shrink-0 overflow-y-auto custom-scrollbar pr-4 -mr-4 border-r border-gray-200">
                        <ul className="space-y-2">
                            {scenarios.map(scenario => {
                                const isActive = scenario.id === activeScenarioId;
                                return (
                                <li key={scenario.id}>
                                    <button 
                                        onClick={() => onSelectScenario(scenario.id)} 
                                        className={`w-full text-left p-3 rounded-lg transition-colors relative text-sm ${
                                            isActive 
                                            ? 'bg-[#EC7200]/20 text-[#1A1628] font-semibold' 
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-[#EC7200] rounded-l-lg"></div>}
                                        {scenario.title}
                                    </button>
                                </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Scenario Details */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {activeScenario && <ScenarioDetail scenario={activeScenario} modelId={model.id} />}
                    </div>
                 </div>
            </div>
        </div>
    );
};