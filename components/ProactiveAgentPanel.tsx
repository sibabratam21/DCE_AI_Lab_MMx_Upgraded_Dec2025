import React from 'react';
import { ProactiveAction } from '../services/agentPersonality';

interface ProactiveAgentPanelProps {
    actions: ProactiveAction[];
    onActionClick?: (actionId: string) => void;
    onDismiss?: (actionId: string) => void;
}

export const ProactiveAgentPanel: React.FC<ProactiveAgentPanelProps> = ({ 
    actions, 
    onActionClick, 
    onDismiss 
}) => {
    if (actions.length === 0) return null;

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'border-red-200 bg-red-50';
            case 'medium': return 'border-yellow-200 bg-yellow-50';
            case 'low': return 'border-blue-200 bg-blue-50';
            default: return 'border-gray-200 bg-gray-50';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'suggestion': return '💡';
            case 'warning': return '⚠️';
            case 'optimization': return '🎯';
            case 'insight': return '🔍';
            default: return '💬';
        }
    };

    return (
        <div className="space-y-2 mb-4">
            {actions.map((action) => (
                <div
                    key={action.id}
                    className={`p-3 rounded-lg border ${getPriorityColor(action.priority)} relative`}
                >
                    {action.dismissible && onDismiss && (
                        <button
                            onClick={() => onDismiss(action.id)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    )}
                    
                    <div className="flex items-start space-x-2">
                        <span className="text-lg flex-shrink-0">
                            {getTypeIcon(action.type)}
                        </span>
                        <div className="flex-grow">
                            <p className="text-sm text-gray-700 mb-2">
                                {action.message}
                            </p>
                            
                            {action.actionButton && onActionClick && (
                                <button
                                    onClick={() => onActionClick(action.id)}
                                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    {action.actionButton.text}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};