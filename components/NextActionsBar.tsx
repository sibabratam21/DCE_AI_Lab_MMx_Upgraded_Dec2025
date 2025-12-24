import React from 'react';
import { ProposedAction } from '../services/agentPlanner';

interface NextActionsBarProps {
  actions: ProposedAction[];
  onActionClick?: (actionId: string) => void;
}

export const NextActionsBar: React.FC<NextActionsBarProps> = ({ actions, onActionClick }) => {
  if (actions.length === 0) {
    return null;
  }


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

  return (
    <div className="space-y-2">
      {actions.map((action) => (
          <div
            key={action.id}
            className={`border rounded-lg p-3 ${getPriorityStyles(action.priority)} transition-shadow hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: Icon + Content */}
              <div className="flex items-start gap-2 flex-1">
                <span className="text-xl flex-shrink-0 mt-0.5">{action.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-800">{action.title}</h4>
                    {getPriorityBadge(action.priority)}
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{action.description}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getCategoryBadgeStyles(action.category)}`}>
                      {action.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Action Button */}
              {action.actionable && action.actionLabel && onActionClick && (
                <button
                  onClick={() => onActionClick(action.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  {action.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
};
