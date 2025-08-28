import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { gateContributions, createChartData, ChannelContribution, ChannelDiagnostic } from '../utils/contributionGating';

interface GatedContributionChartProps {
  contributions: ChannelContribution[];
  diagnostics: ChannelDiagnostic[];
  modelAlgo: string;
  includeAll?: boolean;
  onToggleIncludeAll?: (includeAll: boolean) => void;
  showToggle?: boolean;
}

const chartColors = {
  reportable: '#32A29B',
  negative: '#ef4444', // Red for negative contributions in debug mode
  hidden: '#9CA3AF',
  text: '#1A1628'
};

export const GatedContributionChart: React.FC<GatedContributionChartProps> = ({
  contributions,
  diagnostics,
  modelAlgo,
  includeAll = false,
  onToggleIncludeAll,
  showToggle = true
}) => {
  // Gate the contributions
  const gatedData = gateContributions(contributions, diagnostics, modelAlgo, includeAll);
  
  // Create chart data
  const chartData = includeAll 
    ? contributions.map(c => ({
        name: c.channel,
        contribution: c.percentage,
        color: c.value < 0 ? chartColors.negative : chartColors.reportable,
        isNegative: c.value < 0
      }))
    : createChartData(gatedData);

  const hiddenCount = gatedData.hidden.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800">Channel Contribution</h4>
        {showToggle && onToggleIncludeAll && (
          <button
            onClick={() => onToggleIncludeAll(!includeAll)}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border"
            title={includeAll ? "Hide negative/insignificant effects" : "Show all contributions (debug)"}
          >
            {includeAll ? 'Hide filtered' : 'Include all (debug)'}
          </button>
        )}
      </div>

      {/* Info chip when hiding effects */}
      {!includeAll && hiddenCount > 0 && (
        <div className="mb-3">
          <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            <span className="mr-1">ℹ️</span>
            Hiding {hiddenCount} negative/insignificant effect{hiddenCount !== 1 ? 's' : ''} (see diagnostics)
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart 
            data={chartData}
            layout="vertical" 
            margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={75} 
              stroke={chartColors.text} 
              fontSize={11} 
              interval={0} 
            />
            <Tooltip 
              wrapperClassName="glass-pane" 
              cursor={{ fill: 'rgba(0,0,0, 0.05)' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Contribution']}
            />
            <Bar dataKey="contribution" name="Contribution">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || chartColors.reportable}
                  stroke={entry.isHidden ? '#6B7280' : 'none'}
                  strokeWidth={entry.isHidden ? 1 : 0}
                  strokeDasharray={entry.isHidden ? '2,2' : 'none'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reconciliation info (development) */}
      {process.env.NODE_ENV === 'development' && !gatedData.reconciliationCheck.isValid && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠️ Reconciliation error: {gatedData.reconciliationCheck.difference.toFixed(6)}
        </div>
      )}

      {/* Summary stats */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>
          Visible: {gatedData.reportable.length} channels ({gatedData.reconciliationCheck.visibleSum.toFixed(1)}%)
        </div>
        {!includeAll && gatedData.hiddenSum !== 0 && (
          <div>
            Hidden: {gatedData.hidden.length} channels ({((Math.abs(gatedData.hiddenSum) / gatedData.totalSum) * 100).toFixed(1)}%)
          </div>
        )}
        <div>
          Total: {gatedData.totalSum.toFixed(1)}% 
          {gatedData.reconciliationCheck.isValid ? ' ✓' : ` ⚠️ (${gatedData.reconciliationCheck.difference.toFixed(6)} error)`}
        </div>
      </div>
    </div>
  );
};