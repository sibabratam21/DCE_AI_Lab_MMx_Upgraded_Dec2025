import React from 'react';
import { AgentMessage } from '../types';
import { AiIcon } from './icons/AiIcon';

interface ChatMessageProps {
  message: AgentMessage;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
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
      </div>
    </div>
  );
};