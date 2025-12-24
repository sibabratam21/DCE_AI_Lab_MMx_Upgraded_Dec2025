import React, { useState } from 'react';
import { AppStep } from '../types';

export interface CheckpointItem {
  label: string;
  value: string;
  isWarning?: boolean;
}

export interface DecisionCheckpointModalProps {
  isOpen: boolean;
  title: string;
  step: AppStep;
  itemsBeingLocked: CheckpointItem[];
  downstreamImpact: string[];
  onLockAndProceed: () => void;
  onEdit: () => void;
  onProceedAnyway?: (reason: string) => void;
  allowProceedAnyway?: boolean;
}

export const DecisionCheckpointModal: React.FC<DecisionCheckpointModalProps> = ({
  isOpen,
  title,
  step,
  itemsBeingLocked,
  downstreamImpact,
  onLockAndProceed,
  onEdit,
  onProceedAnyway,
  allowProceedAnyway = false
}) => {
  const [showOverrideReason, setShowOverrideReason] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  if (!isOpen) return null;

  const hasWarnings = itemsBeingLocked.some(item => item.isWarning);

  const handleProceedAnyway = () => {
    if (overrideReason.trim().length < 10) {
      alert('Please provide a detailed reason (at least 10 characters) for proceeding anyway.');
      return;
    }
    if (onProceedAnyway) {
      onProceedAnyway(overrideReason);
      setShowOverrideReason(false);
      setOverrideReason('');
    }
  };

  const handleCancel = () => {
    setShowOverrideReason(false);
    setOverrideReason('');
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className={`px-6 py-4 border-b ${hasWarnings ? 'bg-yellow-50 border-yellow-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {hasWarnings ? '⚠️' : '🔒'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Review and confirm your decisions before proceeding
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Items Being Locked */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>Decisions to Lock</span>
              </h3>
              <div className="space-y-2">
                {itemsBeingLocked.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      item.isWarning
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">
                          {item.label}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.value}
                        </div>
                      </div>
                      {item.isWarning && (
                        <span className="flex-shrink-0 text-yellow-600">⚠️</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Downstream Impact */}
            {downstreamImpact.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>🔗</span>
                  <span>Downstream Impact</span>
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <ul className="space-y-2">
                    {downstreamImpact.map((impact, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">→</span>
                        <span>{impact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Warning Message */}
            {hasWarnings && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-lg flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                      Warning: Potential Issues Detected
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Some items have warnings. Please review carefully before locking these decisions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Override Reason Input */}
            {showOverrideReason && (
              <div className="bg-purple-50 border border-purple-300 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Proceeding Anyway <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you're proceeding despite warnings (minimum 10 characters)..."
                  className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be logged with your decision for audit purposes.
                </p>
              </div>
            )}

            {/* Lock Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="text-gray-600 text-lg flex-shrink-0">ℹ️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    What does "Lock & Proceed" mean?
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Locking these decisions creates an audit trail and prevents accidental changes.
                    You can always edit them later if needed, but it will require explicit justification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {showOverrideReason ? (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedAnyway}
                  disabled={overrideReason.trim().length < 10}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm & Proceed Anyway
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={onEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  ← Go Back & Edit
                </button>
                <div className="flex items-center gap-3">
                  {allowProceedAnyway && hasWarnings && (
                    <button
                      onClick={() => setShowOverrideReason(true)}
                      className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-md hover:bg-purple-100 transition-colors"
                    >
                      Proceed Anyway
                    </button>
                  )}
                  <button
                    onClick={onLockAndProceed}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <span>🔒</span>
                    <span>Lock & Proceed</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
