import React, { useState } from 'react';
import { DecisionRecord, AppStep } from '../types';
import { ProposedAction } from '../services/agentPlanner';

interface AgentPanelProps {
  actions: ProposedAction[];
  decisions: DecisionRecord[];
  onActionClick?: (actionId: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  actions,
  decisions,
  onActionClick
}) => {
  const [activeTab, setActiveTab] = useState<'actions' | 'decisions'>('actions');

  const getStepName = (step: AppStep): string => {
    const stepNames: Record<AppStep, string> = {
      [AppStep.Welcome]: 'Welcome',
      [AppStep.Configure]: 'Configure',
      [AppStep.DataValidation]: 'Data Validation',
      [AppStep.FeatureEngineering]: 'Feature Engineering',
      [AppStep.Modeling]: 'Modeling',
      [AppStep.Report]: 'Report',
      [AppStep.Optimize]: 'Optimize'
    };
    return stepNames[step] || 'Unknown';
  };

  const getPriorityStyles = (priority: ProposedAction['priority']): string => {
    switch (priority) {
      case 'HIGH':
        return 'border-red-300 bg-red-50';
      case 'MEDIUM':
        return 'border-yellow-300 bg-yellow-50';
      case 'LOW':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getCategoryBadgeStyles = (category: ProposedAction['category']): string => {
    switch (category) {
      case 'CONFIGURATION':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'DATA_QUALITY':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'MODELING':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'OPTIMIZATION':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'WARNING':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getPriorityBadge = (priority: ProposedAction['priority']): JSX.Element => {
    const styles = {
      HIGH: 'bg-red-600 text-white',
      MEDIUM: 'bg-yellow-600 text-white',
      LOW: 'bg-blue-600 text-white'
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  const getTypeBadgeStyles = (type: DecisionRecord['type']): string => {
    const styles = {
      RECOMMENDATION: 'bg-blue-100 text-blue-700 border-blue-300',
      WARNING: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      LOCK: 'bg-green-100 text-green-700 border-green-300',
      OVERRIDE: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    return styles[type] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getStatusBadgeStyles = (status: DecisionRecord['status']): string => {
    const styles = {
      ACTIVE: 'bg-white text-gray-600 border-gray-300',
      LOCKED: 'bg-emerald-50 text-emerald-700 border-emerald-400',
      OVERRIDDEN: 'bg-red-50 text-red-600 border-red-300'
    };
    return styles[status] || 'bg-gray-50 text-gray-600 border-gray-300';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const sortedDecisions = [...decisions].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
      {/* Compact horizontal layout */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('actions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'actions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-white/50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Actions</span>
              {actions.length > 0 && (
                <span className={`text-xs font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ${
                  activeTab === 'actions' ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  {actions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('decisions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'decisions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-white/50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Decisions</span>
              {decisions.length > 0 && (
                <span className={`text-xs font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ${
                  activeTab === 'decisions' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-white'
                }`}>
                  {decisions.length}
                </span>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-600">
            {activeTab === 'actions' ? 'Suggested next steps' : 'Recent decisions'}
          </div>
        </div>

      {/* Compact Content */}
      <div className="max-h-32 overflow-y-auto custom-scrollbar">
        {activeTab === 'actions' ? (
          // Next Actions Tab
          actions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-sm">All caught up!</p>
              <p className="text-gray-400 text-xs mt-1">No immediate actions needed.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className={`bg-white rounded-md p-2.5 border border-gray-200 hover:border-indigo-300 transition-all hover:shadow-sm`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-gray-800 truncate">{action.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${
                          action.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                          action.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {action.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{action.description}</p>
                    </div>
                    {action.actionable && action.actionLabel && onActionClick && (
                      <button
                        onClick={() => onActionClick(action.id)}
                        className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                      >
                        {action.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Decisions Tab
          sortedDecisions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-sm">No decisions logged yet</p>
              <p className="text-gray-400 text-xs mt-1">Decisions will appear as you progress</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="bg-white rounded-md p-2.5 border border-gray-200 hover:border-indigo-300 transition-all hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-xs font-semibold text-gray-800 truncate">
                          {decision.summary}
                        </h3>
                        {decision.status === 'LOCKED' && (
                          <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {getStepName(decision.step)} • {formatTimestamp(decision.timestamp)}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap flex-shrink-0 ${getTypeBadgeStyles(decision.type)}`}>
                      {decision.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      </div>
    </div>
  );
};
