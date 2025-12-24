import React, { useState } from 'react';
import { DecisionRecord, AppStep } from '../types';
import { ProposedAction } from '../services/agentPlanner';
import { NextActionsBar } from './NextActionsBar';

interface DecisionLogPanelProps {
  decisions: DecisionRecord[];
  proposedActions: ProposedAction[];
  isOpen: boolean;
  onToggle: () => void;
  onActionClick?: (actionId: string) => void;
}

export const DecisionLogPanel: React.FC<DecisionLogPanelProps> = ({
  decisions,
  proposedActions,
  isOpen,
  onToggle,
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

  const getTypeIcon = (type: DecisionRecord['type']): string => {
    const icons = {
      RECOMMENDATION: '💡',
      WARNING: '⚠️',
      LOCK: '🔒',
      OVERRIDE: '🔄'
    };
    return icons[type] || '📝';
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

  // Sort decisions by timestamp (newest first)
  const sortedDecisions = [...decisions].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <>
      {/* Toggle Button - Fixed position, better placement */}
      <button
        onClick={onToggle}
        className="fixed top-20 right-6 z-40 bg-white shadow-lg rounded-lg px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-200 flex items-center gap-2"
        title="Toggle Agent Panel"
      >
        <span className="text-sm font-medium text-gray-700">
          🤖 Agent Panel
        </span>
        {(proposedActions.length > 0 || decisions.length > 0) && (
          <span className="bg-indigo-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {proposedActions.length + decisions.length}
          </span>
        )}
        <span className="text-gray-500 transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {isOpen ? '✕' : '📋'}
        </span>
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-30 transition-opacity duration-300"
          onClick={onToggle}
        />
      )}

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">🤖 Agent Panel</h2>
                <p className="text-xs text-gray-600 mt-1">
                  Recommendations & Decision History
                </p>
              </div>
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close panel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-t border-indigo-200">
              <button
                onClick={() => setActiveTab('actions')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'actions'
                    ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>💡 Next Actions</span>
                  {proposedActions.length > 0 && (
                    <span className="bg-indigo-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {proposedActions.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('decisions')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'decisions'
                    ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>📋 Decisions</span>
                  {decisions.length > 0 && (
                    <span className="bg-gray-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {decisions.length}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'actions' ? (
              /* Next Actions Tab */
              proposedActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">✨</div>
                  <p className="text-gray-500 text-sm">All caught up!</p>
                  <p className="text-gray-400 text-xs mt-2">
                    No immediate actions needed. Continue your workflow.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <NextActionsBar actions={proposedActions} onActionClick={onActionClick} />
                </div>
              )
            ) : (
              /* Decisions Tab */
              sortedDecisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-500 text-sm">No decisions logged yet</p>
                  <p className="text-gray-400 text-xs mt-2">
                    Decisions will appear here as you progress through the workflow
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedDecisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getTypeIcon(decision.type)}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800 leading-tight">
                              {decision.summary}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {getStepName(decision.step)} • {formatTimestamp(decision.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                        {decision.details}
                      </p>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-1 rounded-md border font-medium ${getTypeBadgeStyles(
                            decision.type
                          )}`}
                        >
                          {decision.type}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-md border font-medium ${getStatusBadgeStyles(
                            decision.status
                          )}`}
                        >
                          {decision.status === 'LOCKED' && '🔒 '}
                          {decision.status === 'OVERRIDDEN' && '🔄 '}
                          {decision.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              {activeTab === 'actions'
                ? `${proposedActions.length} ${proposedActions.length === 1 ? 'action' : 'actions'} recommended`
                : `${sortedDecisions.length} ${sortedDecisions.length === 1 ? 'decision' : 'decisions'} logged`
              }
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
