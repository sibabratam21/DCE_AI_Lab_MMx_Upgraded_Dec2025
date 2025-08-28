import React, { useState, useMemo } from 'react';
import { EdaResult, UserColumnSelection, ColumnType, ChannelDiagnostic, EdaInsights, ParsedData, TrendDataPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Area, AreaChart, ComposedChart, ReferenceLine } from 'recharts';
import { Loader } from './Loader';
import { movingAverage, createDatasetHash } from '../utils/smooth';

interface DataValidationProps {
    selections: UserColumnSelection;
    insights: EdaInsights | null;
    diagnostics: ChannelDiagnostic[];
    onDiagnosticsChange: (diagnostics: ChannelDiagnostic[]) => void;
    isLoadingInsights: boolean;
    parsedData: ParsedData[];
    onProceed?: () => void;
}

const chartColors = {
  kpi: 'var(--color-teal)', 
  grid: 'rgba(26, 22, 40, 0.1)',
  text: '#1A1628',
  bar: 'var(--color-orange)',
}

const calculateCorrelation = (arr1: number[], arr2: number[]): number => {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    const n = arr1.length;
    if (n === 0) return 0;

    for (let i = 0; i < n; i++) {
        const x = arr1[i] || 0;
        const y = arr2[i] || 0;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
    }
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return numerator / denominator;
};

const getCorrelationColor = (value: number) => {
    if (value === 1) return 'bg-gray-200/50';
    if (Math.abs(value) > 0.7) return 'bg-red-500/30';
    if (Math.abs(value) > 0.4) return 'bg-yellow-500/30';
    return 'bg-white';
};


export const DataValidation: React.FC<DataValidationProps> = ({ 
    selections,
    insights, 
    diagnostics, 
    onDiagnosticsChange, 
    isLoadingInsights,
    parsedData,
    onProceed
}) => {
    
    const [activeTab, setActiveTab] = useState<'diagnostics' | 'correlation' | 'sparsity'>('diagnostics');
    const [correlationData, setCorrelationData] = useState<{ [key: string]: { [key: string]: number } } | null>(null);
    const [sparsityData, setSparsityData] = useState<Array<{ name: string; sparsity: number }> | null>(null);
    const [isLoadingCorrelation, setIsLoadingCorrelation] = useState(false);
    const [isLoadingSparsity, setIsLoadingSparsity] = useState(false);
    const [smoothingMode, setSmoothingMode] = useState<'raw' | 'smoothed'>('smoothed');
    
    // Memoized smoothed data with caching
    const { rawTrendData, smoothedTrendData, datasetHash } = useMemo(() => {
        const rawData = insights?.trendData || [];
        const hash = createDatasetHash(rawData);
        
        if (rawData.length === 0) {
            return { rawTrendData: [], smoothedTrendData: [], datasetHash: hash };
        }
        
        // Extract KPI values, smooth them, then reconstruct data points
        const kpiValues = rawData.map(point => point.kpi);
        const smoothedKpis = movingAverage(kpiValues, 4);
        
        const smoothedData = rawData.map((point, index) => ({
            ...point,
            kpi: smoothedKpis[index]
        }));
        
        return {
            rawTrendData: rawData,
            smoothedTrendData: smoothedData,
            datasetHash: hash
        };
    }, [insights?.trendData]);

    const handleToggleAction = (index: number, isApproved: boolean) => {
        const newDiagnostics = diagnostics.map((diag, i) => i === index ? { ...diag, isApproved } : diag);
        onDiagnosticsChange(newDiagnostics);
    };

    // Only use activity channels for correlation analysis - spend is only for ROI calculations
    const marketingChannels = useMemo(() => Object.keys(selections).filter(key => 
        selections[key] === ColumnType.MARKETING_ACTIVITY
    ), [selections]);

    const loadCorrelationData = () => {
        if (correlationData || isLoadingCorrelation) return;
        
        setIsLoadingCorrelation(true);
        setTimeout(() => {
            const matrix: { [key: string]: { [key: string]: number } } = {};
            for(const ch1 of marketingChannels) {
                matrix[ch1] = {};
                for (const ch2 of marketingChannels) {
                    if(ch1 === ch2) {
                        matrix[ch1][ch2] = 1;
                        continue;
                    }
                    if (matrix[ch2] && typeof matrix[ch2][ch1] !== 'undefined') {
                         matrix[ch1][ch2] = matrix[ch2][ch1];
                         continue;
                    }
                    const data1 = parsedData.map(d => Number(d[ch1]) || 0);
                    const data2 = parsedData.map(d => Number(d[ch2]) || 0);
                    matrix[ch1][ch2] = calculateCorrelation(data1, data2);
                }
            }
            setCorrelationData(matrix);
            setIsLoadingCorrelation(false);
        }, 100);
    };

    const loadSparsityData = () => {
        if (sparsityData || isLoadingSparsity) return;
        
        setIsLoadingSparsity(true);
        setTimeout(() => {
            const data = marketingChannels.map(ch => {
                if (!parsedData || parsedData.length === 0) {
                    return { name: ch, sparsity: 0 };
                }
                const values = parsedData.map(d => d[ch]);
                const zeroCount = values.filter(v => v == null || v === 0 || String(v).trim() === '').length;
                const sparsityPercentage = (zeroCount / parsedData.length) * 100;
                return { name: ch, sparsity: sparsityPercentage };
            });
            setSparsityData(data);
            setIsLoadingSparsity(false);
        }, 100);
    };

    const tabs = [
        { id: 'diagnostics', name: 'Channel Diagnostics' },
        { id: 'correlation', name: 'Correlation Matrix' },
        { id: 'sparsity', name: 'Sparsity Analysis' },
    ];
    
    const renderTabContent = () => {
        switch (activeTab) {
            case 'diagnostics':
                return (
                    <>
                        {/* MixMind Key Insights Panel */}
                        <div className="glass-pane p-6 mb-8">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">MixMind Key Insights</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Sales Trend Insights */}
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-lg border border-blue-200">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                                            </svg>
                                        </div>
                                        <h4 className="font-semibold text-blue-900">Sales Trend Insights</h4>
                                    </div>
                                    <p className="text-blue-800 text-sm leading-relaxed">{(insights as any)?.salesTrendInsights || insights?.trendsSummary}</p>
                                </div>
                                
                                {/* Channel Execution Insights */}
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-lg border border-orange-200">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                                            </svg>
                                        </div>
                                        <h4 className="font-semibold text-orange-900">Channel Execution Insights</h4>
                                    </div>
                                    <p className="text-orange-800 text-sm leading-relaxed">{(insights as any)?.channelExecutionInsights || insights?.diagnosticsSummary}</p>
                                </div>
                            </div>
                        </div>

                        {/* Sales Trend Chart - Full Width */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-800">Sales Trend (Latest 12 Months)</h4>
                                <div className="flex bg-gray-100 rounded-md p-1">
                                    <button
                                        onClick={() => setSmoothingMode('raw')}
                                        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                            smoothingMode === 'raw'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        Raw
                                    </button>
                                    <button
                                        onClick={() => setSmoothingMode('smoothed')}
                                        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                            smoothingMode === 'smoothed'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        Smoothed
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{insights?.trendsSummary}</p>
                            <ResponsiveContainer width="100%" height={350}>
                                <ComposedChart 
                                    data={smoothingMode === 'smoothed' ? smoothedTrendData : rawTrendData}
                                    margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke={chartColors.text} 
                                        tick={{ fontSize: 10, fill: chartColors.text }} 
                                        interval={Math.floor((rawTrendData.length || 52) / 8)}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        tickFormatter={(date) => {
                                            try {
                                                if (!date) return '';
                                                const d = new Date(date);
                                                if (isNaN(d.getTime())) return '';
                                                return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                                            } catch (e) {
                                                console.error('Date formatting error:', e, date);
                                                return '';
                                            }
                                        }}
                                    />
                                    <YAxis 
                                        stroke={chartColors.kpi} 
                                        tick={{ fontSize: 10, fill: chartColors.kpi }} 
                                        domain={[0, 'dataMax * 1.1']}
                                        tickFormatter={(value) => {
                                            if (value >= 1000000) {
                                                return `${(value / 1000000).toFixed(1)}M`;
                                            } else if (value >= 1000) {
                                                return `${(value / 1000).toFixed(0)}k`;
                                            }
                                            return value.toFixed(0);
                                        }}
                                    />
                                    <Tooltip 
                                        wrapperClassName="glass-pane" 
                                        labelFormatter={(date) => {
                                            const d = new Date(date);
                                            return `Week of ${d.toLocaleDateString()}`;
                                        }}
                                        formatter={(value) => [value?.toLocaleString() || '0', 'TRx']}
                                    />
                                    
                                    {/* Always show raw data as thin, semi-transparent line for honesty */}
                                    {smoothingMode === 'smoothed' && (
                                        <Line
                                            type="natural"
                                            dataKey="kpi"
                                            data={rawTrendData}
                                            stroke={chartColors.kpi}
                                            strokeWidth={1}
                                            strokeOpacity={0.3}
                                            fill="none"
                                            connectNulls={true}
                                            dot={false}
                                            name="Raw data"
                                        />
                                    )}
                                    
                                    {/* Main trend line/area */}
                                    <Area 
                                        type="natural"
                                        dataKey="kpi" 
                                        stroke={chartColors.kpi} 
                                        strokeWidth={2.5}
                                        fill={chartColors.kpi}
                                        fillOpacity={smoothingMode === 'smoothed' ? 0.25 : 0.15}
                                        connectNulls={true}
                                        dot={false}
                                        name={smoothingMode === 'smoothed' ? 'Smoothed (4-week avg)' : 'Raw TRx'}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                            
                            {/* Caption */}
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Smoothing is for visualization only.
                            </p>
                        </div>
                        
                        {/* Channel Diagnostics Table */}
                        <div className="mt-12">
                            <h4 className="font-semibold text-gray-800 mb-2">Channel Diagnostics</h4>
                            <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3">Channel</th>
                                        <th className="p-3">Sparsity</th>
                                        <th className="p-3">Volatility (CV)</th>
                                        <th className="p-3">Latest 52W Spend</th>
                                        <th className="p-3">YoY Spend Trend</th>
                                        <th className="p-3 w-2/5">AI Commentary</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {diagnostics.map((d, i) => {
                                        const spendTrendValue = parseFloat((d as any).yoySpendTrend || d.yoyTrend);
                                        const trendColor = spendTrendValue > 0 ? 'text-green-600' : spendTrendValue < 0 ? 'text-red-600' : 'text-gray-700';
                                        const volatilityValue = parseFloat(d.volatility);
                                        const volatilityColor = volatilityValue > 50 ? 'text-yellow-600' : 'text-gray-700';
                                        return (
                                            <tr key={d.name} className="border-b border-gray-200">
                                                <td className="p-3 font-semibold">{d.name}</td>
                                                <td className="p-3">{d.sparsity}</td>
                                                <td className={`p-3 font-mono ${volatilityColor}`}>{d.volatility}</td>
                                                <td className="p-3 font-mono">{(d as any).latest52wSpend || 'N/A'}</td>
                                                <td className={`p-3 font-mono font-bold ${trendColor}`}>{(d as any).yoySpendTrend || d.yoyTrend}</td>
                                                <td className="p-3 text-gray-500 text-xs italic">{d.commentary}</td>
                                                <td className="p-3 text-center">
                                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleAction(i, true)}
                                                            className={`px-3 py-1 text-xs font-medium border rounded-l-lg transition-colors ${d.isApproved ? 'bg-[#32A29B] text-white border-[#32A29B]' : 'bg-transparent text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleAction(i, false)}
                                                            className={`px-3 py-1 text-xs font-medium border rounded-r-lg transition-colors ${!d.isApproved ? 'bg-gray-500 text-white border-gray-500' : 'bg-transparent text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                                        >
                                                            Exclude
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </>
                );
            case 'correlation':
                return (
                     <div className="overflow-x-auto">
                        <p className="text-sm text-gray-600 mb-4">Correlation matrix of marketing channels. High values (&gt;0.7, in red) may indicate multicollinearity, which can make model results unstable.</p>
                        {isLoadingCorrelation ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="text-center">
                                    <Loader />
                                    <p className="mt-2 font-medium text-gray-600">Loading correlation matrix...</p>
                                </div>
                            </div>
                        ) : correlationData ? (
                            <table className="w-full text-center text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border border-gray-200 bg-gray-100"></th>
                                        {marketingChannels.map(ch => <th key={ch} className="p-2 border border-gray-200 bg-gray-100 font-medium">{ch}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {marketingChannels.map(ch1 => (
                                        <tr key={ch1}>
                                            <td className="p-2 border border-gray-200 font-medium bg-gray-100">{ch1}</td>
                                            {marketingChannels.map(ch2 => (
                                                <td key={ch2} className={`p-2 border border-gray-200 font-mono ${getCorrelationColor(correlationData[ch1]?.[ch2] ?? 0)}`}>
                                                    {correlationData[ch1]?.[ch2]?.toFixed(2)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-8 text-gray-500">Click the tab to load correlation data</div>
                        )}
                    </div>
                 );
            case 'sparsity':
                return (
                    <div>
                        <p className="text-sm text-gray-600 mb-4">Sparsity of marketing channels, measured as the percentage of zero-value entries. High sparsity may affect model stability or indicate "flighted" campaigns.</p>
                        {isLoadingSparsity ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="text-center">
                                    <Loader />
                                    <p className="mt-2 font-medium text-gray-600">Loading sparsity analysis...</p>
                                </div>
                            </div>
                        ) : sparsityData ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={sparsityData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                    <XAxis dataKey="name" stroke={chartColors.text} angle={-45} textAnchor="end" interval={0} height={100} tick={{ fontSize: 12 }} />
                                    <YAxis stroke={chartColors.text} unit="%" />
                                    <Tooltip wrapperClassName="glass-pane" formatter={(value) => `${Number(value).toFixed(1)}%`} />
                                    <Bar dataKey="sparsity" name="Sparsity %">
                                        {sparsityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.sparsity > 50 ? '#ef4444' : entry.sparsity > 20 ? '#f59e0b' : chartColors.bar} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center py-8 text-gray-500">Click the tab to load sparsity data</div>
                        )}
                    </div>
                );
        }
    }

    return (
        <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">

            {/* Initial Loader */}
            {isLoadingInsights && !insights && (
                <div className="glass-pane p-6 flex justify-center items-center min-h-[24rem]">
                    <div className="text-center">
                        <Loader />
                        <p className="mt-2 font-medium text-gray-600">Running initial diagnostics...</p>
                    </div>
                </div>
            )}

            {/* Diagnostics & Visuals */}
            {insights && (
                 <div className="glass-pane p-6 relative">
                    {/* Update Loader Overlay */}
                    {isLoadingInsights && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex justify-center items-center rounded-lg z-10">
                            <div className="text-center">
                                <Loader />
                                <p className="mt-2 font-medium text-gray-600">Updating diagnostics...</p>
                            </div>
                        </div>
                    )}

                    <div className={isLoadingInsights ? 'opacity-40 transition-opacity' : ''}>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Validation & Quality Analysis</h2>
                        
                        <div className="border-b border-gray-200 mb-6">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as any);
                                            if (tab.id === 'correlation') loadCorrelationData();
                                            if (tab.id === 'sparsity') loadSparsityData();
                                        }}
                                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                            activeTab === tab.id
                                            ? 'border-[#EC7200] text-[#EC7200]'
                                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                                        }`}
                                    >
                                        {tab.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        
                        <div>
                            {renderTabContent()}
                        </div>
                        
                        {/* Proceed Button */}
                        {insights && onProceed && (
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={onProceed}
                                    disabled={isLoadingInsights}
                                    className="primary-button flex items-center space-x-2"
                                >
                                    <span>Proceed to Feature Engineering</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
            )}
        </div>
    );
};