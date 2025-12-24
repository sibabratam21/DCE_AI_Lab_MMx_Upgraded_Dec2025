import React from 'react';
import { ModelConsistency, ModelRun } from '../types';

interface ModelConsistencyPanelProps {
  consistency: ModelConsistency;
  customerModel: ModelRun | null;
  geoModel: ModelRun | null;
}

export const ModelConsistencyPanel: React.FC<ModelConsistencyPanelProps> = ({
  consistency,
  customerModel,
  geoModel
}) => {
  const getRecommendationBadge = (rec: 'CUSTOMER' | 'GEO' | 'DUAL') => {
    const styles = {
      CUSTOMER: 'bg-blue-100 text-blue-700 border-blue-300',
      GEO: 'bg-green-100 text-green-700 border-green-300',
      DUAL: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    return styles[rec];
  };

  const getAgreementColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAgreementBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header: Overall Agreement */}
      <div className={`rounded-lg border-2 p-6 ${getAgreementBg(consistency.overallAgreementScore)}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Model Consistency Analysis
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              Comparing CUSTOMER-level vs GEO-level modeling perspectives
            </p>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getAgreementColor(consistency.overallAgreementScore)}`}>
              {consistency.overallAgreementScore}%
            </div>
            <div className="text-xs text-gray-600 mt-1">Agreement Score</div>
          </div>
        </div>

        {/* Model Performance Comparison */}
        {customerModel && geoModel && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👤</span>
                <span className="text-xs font-semibold text-gray-700 uppercase">Customer Model</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">R²:</span>
                  <span className="font-semibold">{(customerModel.rsq * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MAPE:</span>
                  <span className="font-semibold">{customerModel.mape.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Algorithm:</span>
                  <span className="font-semibold text-xs">{customerModel.algorithm}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌍</span>
                <span className="text-xs font-semibold text-gray-700 uppercase">GEO Model</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">R²:</span>
                  <span className="font-semibold">{(geoModel.rsq * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MAPE:</span>
                  <span className="font-semibold">{geoModel.mape.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Algorithm:</span>
                  <span className="font-semibold text-xs">{geoModel.algorithm}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommended Model */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-gray-800">Recommendation</h3>
              <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${getRecommendationBadge(consistency.recommendedOwnerModel)}`}>
                {consistency.recommendedOwnerModel === 'DUAL' ? 'Run Both Models' : `${consistency.recommendedOwnerModel} Primary`}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {consistency.reasoning}
            </p>
          </div>
        </div>
      </div>

      {/* Channel-Level Agreement */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>📊</span>
          <span>Channel-Level Agreement</span>
        </h3>

        <div className="space-y-3">
          {consistency.channelAgreement
            .sort((a, b) => a.agreementScore - b.agreementScore) // Show lowest agreement first
            .map(ch => (
              <div
                key={ch.channel}
                className={`rounded-md p-3 border ${
                  ch.consistent ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-800 mb-1">
                      {ch.channel}
                    </div>
                    <div className="text-xs text-gray-600">
                      {ch.consistent ? '✓ Consistent across models' : '⚠️ Moderate variation between models'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getAgreementColor(ch.agreementScore)}`}>
                      {ch.agreementScore}%
                    </div>
                    <div className="text-xs text-gray-500">agreement</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Conflicting Channels */}
      {consistency.conflictingChannels.length > 0 && (
        <div className="bg-red-50 rounded-lg border-2 border-red-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span>⚠️</span>
            <span>Conflicting Channels</span>
            <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full">
              {consistency.conflictingChannels.length}
            </span>
          </h3>
          <p className="text-sm text-gray-700 mb-4">
            These channels show significant disagreement (&lt;70% agreement) between CUSTOMER and GEO models.
            Consider reassigning ownership or running dual models for validation.
          </p>

          <div className="space-y-3">
            {consistency.conflictingChannels.map(conflict => (
              <div key={conflict.channel} className="bg-white rounded-md p-4 border border-red-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">{conflict.channel}</h4>
                    <div className="text-xs text-gray-600 mt-1">
                      {conflict.direction === 'CUSTOMER_HIGHER'
                        ? 'CUSTOMER model shows higher ROI'
                        : 'GEO model shows higher ROI'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md border border-red-300 font-semibold">
                    {conflict.agreementScore}% agreement
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 rounded p-2 border border-blue-200">
                    <div className="text-xs text-gray-600 mb-1">👤 Customer ROI</div>
                    <div className="font-bold text-blue-700">{conflict.customerROI.toFixed(2)}x</div>
                  </div>
                  <div className="bg-green-50 rounded p-2 border border-green-200">
                    <div className="text-xs text-gray-600 mb-1">🌍 GEO ROI</div>
                    <div className="font-bold text-green-700">{conflict.geoROI.toFixed(2)}x</div>
                  </div>
                  <div className="bg-red-50 rounded p-2 border border-red-200">
                    <div className="text-xs text-gray-600 mb-1">Difference</div>
                    <div className="font-bold text-red-700">{conflict.difference.toFixed(2)}x</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-white rounded-md p-4 border border-red-200">
            <h4 className="text-sm font-bold text-gray-800 mb-2">💡 Resolution Options:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Review channel ownership assignments (CUSTOMER vs GEO vs SHARED)</li>
              <li>Run dual models and compare business logic to determine correct perspective</li>
              <li>Check for data quality issues or outliers in these channels</li>
              <li>Consult domain expertise on whether channel operates at customer or market level</li>
            </ul>
          </div>
        </div>
      )}

      {/* No Conflicts - All Clear */}
      {consistency.conflictingChannels.length === 0 && (
        <div className="bg-green-50 rounded-lg border-2 border-green-200 p-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">All Channels Consistent</h3>
              <p className="text-sm text-gray-700">
                No significant conflicts detected. Both CUSTOMER and GEO models show consistent results across all channels.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
