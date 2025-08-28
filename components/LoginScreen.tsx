import React, { useState } from 'react';
import { Logo } from './Logo';

interface LoginScreenProps {
    onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const CORRECT_PASSWORD = 'dce_ai_mmx_2025';
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        // Add a small delay to make it feel more secure
        setTimeout(() => {
            if (password === CORRECT_PASSWORD) {
                // Store authentication in session storage
                sessionStorage.setItem('mmx_authenticated', 'true');
                onLogin();
            } else {
                setError('Invalid password. Please try again.');
                setPassword('');
            }
            setIsLoading(false);
        }, 500);
    };
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="glass-pane p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Logo />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        MixMind - Agentic Marketing Mix Modeling
                    </h1>
                    <p className="text-sm text-gray-600">
                        AI-Powered Marketing Analytics
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Enter Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EC7200] ${
                                error ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="Enter access password"
                            required
                            disabled={isLoading}
                            autoFocus
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-600">
                                {error}
                            </p>
                        )}
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full py-2 px-4 bg-gradient-to-r from-[#EC7200] to-[#FF8C24] text-white font-semibold rounded-lg hover:from-[#DA6600] hover:to-[#FF8C24] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Verifying...
                            </span>
                        ) : (
                            'Access Platform'
                        )}
                    </button>
                </form>
                
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="text-center text-xs text-gray-500">
                        <p className="mb-1">Powered by AI • Built for Marketing Excellence</p>
                        <p>© 2025 DCE AI Lab</p>
                    </div>
                </div>
            </div>
        </div>
    );
};