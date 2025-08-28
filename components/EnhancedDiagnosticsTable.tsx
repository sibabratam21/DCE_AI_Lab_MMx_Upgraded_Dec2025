import React from 'react';
import { isChannelReportable, ChannelDiagnostic, ChannelContribution } from '../utils/contributionGating';

interface EnhancedDiagnosticsTableProps {
  diagnostics: ChannelDiagnostic[];
  contributions: ChannelContribution[];
  modelAlgo: string;
  showAdvanced: boolean;
  includeAll?: boolean;
}

export const EnhancedDiagnosticsTable: React.FC<EnhancedDiagnosticsTableProps> = ({ 
  diagnostics, 
  contributions,
  modelAlgo,
  showAdvanced,
  includeAll = false
}) => {
  if (diagnostics.length === 0) return null;

  // Calculate reportability for each channel
  const reportabilityMap = new Map<string, { isReportable: boolean; reason: string }>();
  
  contributions.forEach(contrib => {
    const diagnostic = diagnostics.find(d => d.channel === contrib.channel);
    const result = isChannelReportable(contrib, diagnostic, modelAlgo);
    reportabilityMap.set(contrib.channel, {
      isReportable: result.isReportable,
      reason: result.reason
    });
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2">Channel</th>
            <th className="p-2">Coeff</th>
            {showAdvanced && <th className="p-2">Std Err</th>}
            <th className="p-2">P-Value</th>
            {showAdvanced && <th className="p-2">95% CI</th>}
            <th className="p-2">Sign</th>
            <th className="p-2">Importance</th>
            <th className="p-2">Shown?</th>
          </tr>
        </thead>
        <tbody>
          {diagnostics.map(diag => {
            const reportability = reportabilityMap.get(diag.channel);
            const isShown = includeAll || (reportability?.isReportable ?? false);
            
            return (
              <tr key={diag.channel} className="border-b border-gray-100">
                <td className="p-2 font-medium">{diag.channel}</td>
                <td className="p-2 font-mono">
                  {diag.coefficient !== undefined ? diag.coefficient.toFixed(4) : '-'}
                </td>
                {showAdvanced && (
                  <td className="p-2 font-mono">
                    {diag.stderr !== undefined ? diag.stderr.toFixed(4) : '-'}
                  </td>
                )}
                <td className="p-2 font-mono">
                  {diag.pValue !== null && diag.pValue !== undefined ? diag.pValue.toFixed(4) : '-'}
                </td>
                {showAdvanced && (
                  <td className="p-2 font-mono text-xs">
                    {diag.confidence_interval 
                      ? `[${diag.confidence_interval[0].toFixed(2)}, ${diag.confidence_interval[1].toFixed(2)}]`
                      : '-'}
                  </td>
                )}
                <td className="p-2">
                  <span className={`px-1 py-0.5 rounded text-xs ${
                    diag.sign === 'positive' ? 'bg-green-100 text-green-800' :
                    diag.sign === 'negative' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {diag.sign === 'positive' ? '+' : 
                     diag.sign === 'negative' ? '-' : 
                     '~'}
                  </span>
                </td>
                <td className="p-2 font-mono">
                  {diag.importance !== undefined ? diag.importance.toFixed(3) : '-'}
                </td>
                <td className="p-2">
                  <div className="flex items-center space-x-1">
                    <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                      isShown 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {isShown ? 'Yes' : 'No'}
                    </span>
                    {reportability && !reportability.isReportable && (
                      <span 
                        className="text-gray-400 cursor-help" 
                        title={reportability.reason}
                      >
                        ℹ️
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Legend */}
      <div className="mt-3 text-xs text-gray-500 space-y-1">
        <div className="font-medium">Reportability rules:</div>
        <div className="ml-2 space-y-1">
          {modelAlgo.includes('Regression') || modelAlgo.includes('Bayesian') || modelAlgo.includes('GLM') ? (
            <>
              <div>• Statistical models: Show if coefficient &gt; 0 AND (p &lt; 0.05 OR CI lower bound &gt; 0)</div>
              <div>• Hidden reasons: Negative coefficient, p ≥ 0.05 with CI crossing zero</div>
            </>
          ) : (
            <>
              <div>• Tree/NN models: Show if SHAP importance &gt; 0</div>
              <div>• Hidden reasons: Non-positive SHAP importance</div>
            </>
          )}
          <div>• Negative contributions are never shown regardless of significance</div>
        </div>
      </div>
    </div>
  );
};