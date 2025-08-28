import React from 'react';
import { EdaResult, UserColumnSelection, ColumnType } from '../types';

interface ConfigureProps {
    edaResults: EdaResult[];
    selections: UserColumnSelection;
    onSelectionsChange: (selections: UserColumnSelection) => void;
    onProceed: () => void;
    isLoading?: boolean;
    onQuestionClick?: (question: string) => void;
}

export const Configure: React.FC<ConfigureProps> = ({ 
    edaResults, 
    selections, 
    onSelectionsChange,
    onProceed,
    isLoading = false,
    onQuestionClick
}) => {
    const handleProceed = () => {
        onProceed();
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