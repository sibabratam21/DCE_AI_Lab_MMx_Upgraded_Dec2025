import React from 'react';
import { AgentMessage } from '../types';
import { AiIcon } from './icons/AiIcon';

interface ChatMessageProps {
  message: AgentMessage;
  onActionClick?: (action: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onActionClick }) => {
  const isAi = message.sender === 'ai';

  return (
    <div className={`flex items-start gap-3 my-4 ${isAi ? '' : 'justify-end'}`}>
      {isAi && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 bg-gray-100">
          <div className="w-5 h-5 text-transparent bg-clip-text bg-gradient-to-br from-[#EC7200] to-[#32A29B]">
            <AiIcon />
          </div>
        </div>
      )}
      <div
        className={`rounded-xl px-4 py-2.5 max-w-md shadow-md ${
          isAi ? 'bg-white text-[#1A1628] border border-gray-200' : 'text-white bg-[#32A29B]'
        }`}
      >
        <div className={`prose prose-sm max-w-none whitespace-pre-wrap ${isAi ? '' : 'prose-invert'}`}>{message.text}</div>
        
        {/* Clickable Action Buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  if (action.onClick) {
                    action.onClick();
                  } else {
                    onActionClick?.(action.text);
                  }
                }}
                disabled={action.disabled}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  action.style === 'primary' 
                    ? 'bg-[#EC7200] text-white border-[#EC7200] hover:bg-[#d86800]' 
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {action.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};