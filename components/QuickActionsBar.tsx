import React from 'react';
import { ChatAction } from '../types';

interface QuickActionsBarProps {
  suggestions: ChatAction[];
  onActionClick: (text: string) => void;
  isDisabled?: boolean;
  maxPills?: number;
  maxChars?: number;
}

const truncateText = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
};

const deduplicate = (suggestions: ChatAction[]): ChatAction[] => {
  const seen = new Set<string>();
  return suggestions.filter(suggestion => {
    const normalizedText = suggestion.text.toLowerCase().trim();
    if (seen.has(normalizedText)) {
      return false;
    }
    seen.add(normalizedText);
    return true;
  });
};

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  suggestions,
  onActionClick,
  isDisabled = false,
  maxPills = 6,
  maxChars = 60
}) => {
  // Filter and deduplicate suggestions
  const processedSuggestions = deduplicate(suggestions)
    .slice(0, maxPills)
    .map(suggestion => ({
      ...suggestion,
      text: truncateText(suggestion.text, maxChars)
    }));

  // Don't render if no suggestions
  if (processedSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="">
      <div className="text-xs text-gray-500 mb-2 px-4">💡 What would you like to explore?</div>
      <div className="flex flex-wrap gap-1 px-4">
        {processedSuggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onActionClick(suggestion.text)}
            disabled={isDisabled}
            aria-label={`Quick action: ${suggestion.text}`}
            className={`text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#EC7200] focus:ring-opacity-50 ${
              suggestion.style === 'primary' 
                ? 'bg-[#EC7200] text-white border-[#EC7200] hover:bg-[#d86800] disabled:hover:bg-[#EC7200]' 
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 disabled:hover:bg-gray-50'
            }`}
          >
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  );
};