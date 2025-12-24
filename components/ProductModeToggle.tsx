import React from 'react';

interface ProductModeToggleProps {
  productMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export const ProductModeToggle: React.FC<ProductModeToggleProps> = ({
  productMode,
  onToggle
}) => {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Mode:
        </span>
        <div className="flex items-center bg-gray-100 rounded-md p-1">
          <button
            onClick={() => onToggle(true)}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              productMode
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Product</span>
            </div>
          </button>
          <button
            onClick={() => onToggle(false)}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              !productMode
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Analyst</span>
            </div>
          </button>
        </div>
      </div>

      {/* Mode description */}
      <div className="border-l border-gray-300 pl-3">
        <p className="text-xs text-gray-600 max-w-xs">
          {productMode ? (
            <>
              <span className="font-semibold text-green-700">Product Mode:</span> Deterministic logic only, no API calls
            </>
          ) : (
            <>
              <span className="font-semibold text-indigo-700">Analyst Mode:</span> AI-powered insights with Gemini API
            </>
          )}
        </p>
      </div>

      {/* Status indicator */}
      <div className="ml-auto">
        {productMode ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-200 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Safe Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 font-medium">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            AI Active
          </span>
        )}
      </div>
    </div>
  );
};
