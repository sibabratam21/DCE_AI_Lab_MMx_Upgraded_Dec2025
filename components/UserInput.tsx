import React from 'react';
import { FiSend } from 'react-icons/fi';

interface UserInputProps {
  onSubmit: (text: string) => void;
  placeholder: string;
  disabled?: boolean;
  value: string;
  onValueChange: (text: string) => void;
}

export const UserInput: React.FC<UserInputProps> = ({ onSubmit, placeholder, disabled, value, onValueChange }) => {

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim() && !disabled) {
            onSubmit(value.trim());
            onValueChange('');
        }
    };
    
    return (
        <div className="p-4 border-t border-gray-200 bg-white/70">
            <form onSubmit={handleSubmit}>
                <label htmlFor="user-input" className="sr-only">Your feedback</label>
                <div className="relative">
                    <textarea
                        id="user-input"
                        rows={2}
                        className="block w-full resize-none rounded-lg border-0 bg-gray-100 py-2.5 pl-4 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#EC7200] sm:text-sm sm:leading-6 disabled:opacity-50 transition-all"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onValueChange(e.target.value)}
                        disabled={disabled}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                handleSubmit(e);
                            }
                        }}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <button 
                            type="submit" 
                            className="inline-flex items-center justify-center rounded-md h-8 w-8 text-white bg-[#EC7200] hover:bg-[#d86800] focus:outline-none focus:ring-2 focus:ring-[#EC7200] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                            disabled={!value.trim() || disabled}
                        >
                            <FiSend className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Send feedback</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};