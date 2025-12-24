import React, { useState } from 'react';
import { CriticWarning } from '../types';
import { getRuleName } from '../services/agentCritic';

interface CriticWarningModalProps {
  isOpen: boolean;
  warnings: CriticWarning[];
  onAcknowledge: () => void;
  onOverride: (reason: string) => void;
  onGoBack: () => void;
}

export const CriticWarningModal: React.FC<CriticWarningModalProps> = ({
  isOpen,
  warnings,
  onAcknowledge,
  onOverride,
  onGoBack
}) => {
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  if (!isOpen || warnings.length === 0) return null;

  const hasErrors = warnings.some(w => w.severity === 'ERROR');
  const allCanOverride = warnings.every(w => w.canOverride);
  const someCanOverride = warnings.some(w => w.canOverride);

  const handleAcknowledge = () => {
    setShowOverrideInput(false);
    setOverrideReason('');
    onAcknowledge();
  };

  const handleOverrideRequest = () => {
    setShowOverrideInput(true);
  };

  const handleConfirmOverride = () => {
    if (overrideReason.trim().length < 10) {
      alert('Please provide a detailed reason (minimum 10 characters) for overriding these warnings.');
      return;
    }
    onOverride(overrideReason);
    setShowOverrideInput(false);
    setOverrideReason('');
  };

  const getSeverityStyles = (severity: CriticWarning['severity']) => {
    return severity === 'ERROR'
      ? 'bg-red-50 border-red-300 text-red-800'
      : 'bg-yellow-50 border-yellow-300 text-yellow-800';
  };

  const getSeverityBadge = (severity: CriticWarning['severity']) => {
    return severity === 'ERROR'
      ? 'bg-red-600 text-white'
      : 'bg-yellow-600 text-white';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className={`px-6 py-4 border-b ${hasErrors ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">
                {hasErrors ? '🚫' : '⚠️'}
              </span>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">
                  {hasErrors ? 'Critical Issue Detected' : 'Best Practice Warning'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {warnings.length} {warnings.length === 1 ? 'issue' : 'issues'} detected by the agent critic
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {warnings.map((warning, index) => (
                <div
                  key={warning.id}
                  className={`border rounded-lg p-4 ${getSeverityStyles(warning.severity)}`}
                >
                  {/* Warning Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getSeverityBadge(warning.severity)}`}>
                          {warning.severity}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white border border-gray-300 font-medium text-gray-700">
                          {getRuleName(warning.rule)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-gray-800">
                        {warning.title}
                      </h3>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                      Why This Matters:
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {warning.explanation}
                    </p>
                  </div>

                  {/* Recommendation */}
                  <div className="bg-white bg-opacity-60 rounded-md p-3 border border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      💡 Recommendation:
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {warning.recommendation}
                    </p>
                  </div>

                  {/* Override indicator */}
                  {!warning.canOverride && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-700">
                      <span>🔒</span>
                      <span className="font-medium">This issue must be resolved before proceeding</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Override Input */}
            {showOverrideInput && (
              <div className="mt-4 bg-purple-50 border border-purple-300 rounded-lg p-4">
                <h3 className="text-sm font-bold text-purple-900 mb-2">
                  Override Justification Required
                </h3>
                <p className="text-xs text-purple-700 mb-3">
                  You are choosing to proceed despite the agent's warnings. Please provide a detailed explanation of why you believe this is the right decision. Your reason will be logged in the decision history.
                </p>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain your reasoning for overriding these warnings (minimum 10 characters)..."
                  className="w-full border border-purple-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                  autoFocus
                />
                <p className="text-xs text-purple-600 mt-2">
                  {overrideReason.length}/10 characters minimum
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Go Back */}
              <button
                onClick={onGoBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                ← Go Back & Fix
              </button>

              {/* Right: Actions */}
              <div className="flex items-center gap-3">
                {!showOverrideInput ? (
                  <>
                    {/* Acknowledge (only if no errors OR all warnings can be overridden) */}
                    {!hasErrors && (
                      <button
                        onClick={handleAcknowledge}
                        className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100 transition-colors"
                      >
                        ✓ Acknowledge & Proceed
                      </button>
                    )}

                    {/* Override (only if some warnings can be overridden) */}
                    {someCanOverride && (
                      <button
                        onClick={handleOverrideRequest}
                        className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-md hover:bg-purple-100 transition-colors"
                      >
                        Override Anyway
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowOverrideInput(false);
                        setOverrideReason('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmOverride}
                      disabled={overrideReason.trim().length < 10}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Override
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
