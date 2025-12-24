import React, { useMemo } from 'react';
import { EdaResult, UserColumnSelection, ColumnType } from '../types';

interface ConfigureProps {
    edaResults: EdaResult[];
    selections: UserColumnSelection;
    onSelectionsChange: (selections: UserColumnSelection) => void;
    channelOwnership?: Record<string, 'CUSTOMER' | 'GEO' | 'SHARED'>;
    onOwnershipChange?: (ownership: Record<string, 'CUSTOMER' | 'GEO' | 'SHARED'>) => void;
    onProceed: () => void;
    isLoading?: boolean;
    onQuestionClick?: (question: string) => void;
}

export const Configure: React.FC<ConfigureProps> = ({
    edaResults,
    selections,
    onSelectionsChange,
    channelOwnership = {},
    onOwnershipChange,
    onProceed,
    isLoading = false,
    onQuestionClick
}) => {
    const handleProceed = () => {
        onProceed();
    };

    // Get marketing channels that need ownership assignment
    const marketingChannels = useMemo(() => {
        return edaResults.filter(col => {
            const colType = selections[col.columnName] || col.suggestedType;
            return colType === ColumnType.MARKETING_SPEND || colType === ColumnType.MARKETING_ACTIVITY;
        });
    }, [edaResults, selections]);

    const handleOwnershipChange = (channelName: string, ownership: 'CUSTOMER' | 'GEO' | 'SHARED') => {
        if (onOwnershipChange) {
            onOwnershipChange({
                ...channelOwnership,
                [channelName]: ownership
            });
        }
    };

    const getColumnTypeDescription = (type: ColumnType) => {
        switch (type) {
            case ColumnType.DEPENDENT_VARIABLE:
                return "Your main business metric (sales, conversions, prescriptions)";
            case ColumnType.TIME_DIMENSION:
                return "Date or time period column for trend analysis";
            case ColumnType.GEO_DIMENSION:
                return "Geographic identifier (DMA, region, store)";
            case ColumnType.MARKETING_SPEND:
                return "Marketing spend/investment amounts";
            case ColumnType.MARKETING_ACTIVITY:
                return "Marketing activity metrics (impressions, clicks, GRPs)";
            case ColumnType.CONTROL_VARIABLE:
                return "External factors (seasonality, competitors, events)";
            case ColumnType.IGNORE:
                return "Exclude from analysis";
            default:
                return "";
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">
            <div className="glass-pane p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Configure Your Data</h2>
                <p className="text-gray-600 mb-6">
                    I've analyzed your columns and suggested roles for each. Review and adjust as needed for your Marketing Mix Model.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {edaResults.map(col => (
                        <div key={col.columnName} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-gray-900">{col.columnName}</h3>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {col.suggestedType === (selections[col.columnName] || col.suggestedType) ? 'AI Suggested' : 'Modified'}
                                </span>
                            </div>
                            
                            <select
                                value={selections[col.columnName] || col.suggestedType}
                                onChange={(e) => onSelectionsChange({ ...selections, [col.columnName]: e.target.value as ColumnType })}
                                className="w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#EC7200] focus:border-[#EC7200] text-gray-900 mb-2"
                            >
                                {Object.values(ColumnType).map(ct => (
                                    <option key={ct} value={ct}>{ct}</option>
                                ))}
                            </select>
                            
                            <p className="text-xs text-gray-500">
                                {getColumnTypeDescription(selections[col.columnName] || col.suggestedType)}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Channel Ownership Section */}
                {marketingChannels.length > 0 && onOwnershipChange && (
                    <div className="mt-8 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-start gap-3 mb-4">
                            <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">Channel Ownership Assignment</h3>
                                <p className="text-sm text-gray-700 mb-3">
                                    Assign each marketing channel to CUSTOMER-level (digital, direct response) or GEO-level (TV, brand, broad reach) models. This determines how channels are aggregated and modeled.
                                </p>
                                <div className="space-y-2">
                                    {marketingChannels.map(channel => (
                                        <div key={channel.columnName} className="bg-white rounded-md p-3 border border-indigo-100">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-semibold text-gray-800">{channel.columnName}</h4>
                                                    <p className="text-xs text-gray-600 mt-0.5">
                                                        {selections[channel.columnName] === ColumnType.MARKETING_SPEND ? 'Spend Channel' : 'Activity Channel'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOwnershipChange(channel.columnName, 'CUSTOMER')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                            channelOwnership[channel.columnName] === 'CUSTOMER'
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <span>CUSTOMER</span>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOwnershipChange(channel.columnName, 'GEO')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                            channelOwnership[channel.columnName] === 'GEO'
                                                                ? 'bg-green-600 text-white shadow-sm'
                                                                : 'bg-white text-gray-700 border border-gray-300 hover:border-green-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            <span>GEO</span>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOwnershipChange(channel.columnName, 'SHARED')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                            channelOwnership[channel.columnName] === 'SHARED'
                                                                ? 'bg-purple-600 text-white shadow-sm'
                                                                : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                            </svg>
                                                            <span>SHARED</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {Object.keys(channelOwnership).length === 0 && (
                                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                        <strong>Note:</strong> Ownership assignment is recommended for dual model analysis (CUSTOMER vs GEO comparison).
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleProceed}
                        disabled={isLoading}
                        className="primary-button flex items-center space-x-2"
                    >
                        <span>{isLoading ? 'Processing...' : 'Proceed to Validation'}</span>
                        {!isLoading && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

        </div>
    );
};