import React from 'react';
import { ModelDetail } from '../types';

interface ParameterChipsProps {
  details: ModelDetail[];
  baselineDetails?: ModelDetail[];
  compact?: boolean;
}

export const ParameterChips: React.FC<ParameterChipsProps> = ({ details, baselineDetails, compact = false }) => {
  const includedDetails = details.filter(d => d.included);
  
  if (includedDetails.length === 0) {
    return <span className="text-xs text-gray-400">No channels included</span>;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'max-w-xs' : ''}`}>
      {includedDetails.slice(0, compact ? 3 : includedDetails.length).map(detail => {
        const baseline = baselineDetails?.find(b => b.name === detail.name);
        const hasChanges = baseline && (
          Math.abs(detail.adstock - baseline.adstock) > 0.05 ||
          detail.lag !== baseline.lag ||
          detail.transform !== baseline.transform
        );

        return (
          <div
            key={detail.name}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              hasChanges 
                ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <span className="font-semibold">{detail.name}</span>
            <span className="text-xs opacity-75">
              a={detail.adstock.toFixed(2)} L={detail.lag}
            </span>
          </div>
        );
      })}
      
      {compact && includedDetails.length > 3 && (
        <span className="text-xs text-gray-500 px-2 py-1">
          +{includedDetails.length - 3} more
        </span>
      )}
    </div>
  );
};

interface ParameterDifferencesProps {
  currentModel: { details: ModelDetail[] };
  baselineModel: { details: ModelDetail[] };
}

export const ParameterDifferences: React.FC<ParameterDifferencesProps> = ({ 
  currentModel, 
  baselineModel 
}) => {
  const differences: Array<{
    channel: string;
    field: string;
    current: any;
    baseline: any;
    type: 'changed' | 'added' | 'removed';
  }> = [];

  // Compare parameters
  currentModel.details.forEach(current => {
    const baseline = baselineModel.details.find(b => b.name === current.channel);
    
    if (!baseline) {
      if (current.included) {
        differences.push({
          channel: current.channel,
          field: 'inclusion',
          current: 'included',
          baseline: 'not present',
          type: 'added'
        });
      }
      return;
    }

    // Check inclusion changes
    if (current.included !== baseline.included) {
      differences.push({
        channel: current.channel,
        field: 'inclusion',
        current: current.included ? 'included' : 'excluded',
        baseline: baseline.included ? 'included' : 'excluded',
        type: 'changed'
      });
    }

    // Only check parameter changes for included channels
    if (current.included) {
      // Check adstock changes
      if (Math.abs(current.adstock - baseline.adstock) > 0.05) {
        differences.push({
          channel: current.channel,
          field: 'adstock',
          current: current.adstock.toFixed(2),
          baseline: baseline.adstock.toFixed(2),
          type: 'changed'
        });
      }

      // Check lag changes
      if (current.lag !== baseline.lag) {
        differences.push({
          channel: current.channel,
          field: 'lag',
          current: current.lag,
          baseline: baseline.lag,
          type: 'changed'
        });
      }

      // Check transform changes
      if (current.transform !== baseline.transform) {
        differences.push({
          channel: current.channel,
          field: 'transform',
          current: current.transform,
          baseline: baseline.transform,
          type: 'changed'
        });
      }
    }
  });

  // Check for removed channels
  baselineModel.details.forEach(baseline => {
    const current = currentModel.details.find(c => c.name === baseline.channel);
    if (!current && baseline.included) {
      differences.push({
        channel: baseline.channel,
        field: 'inclusion',
        current: 'not present',
        baseline: 'included',
        type: 'removed'
      });
    }
  });

  if (differences.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No parameter differences from baseline model
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-gray-800 text-sm">Differences vs Baseline</h5>
      <div className="space-y-1">
        {differences.map((diff, idx) => (
          <div key={idx} className={`text-xs px-2 py-1 rounded ${
            diff.type === 'added' ? 'bg-green-50 text-green-700' :
            diff.type === 'removed' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            <span className="font-medium">{diff.channel}</span>
            <span className="mx-1">•</span>
            <span className="capitalize">{diff.field}:</span>
            <span className="ml-1">
              {diff.baseline} → {diff.current}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};