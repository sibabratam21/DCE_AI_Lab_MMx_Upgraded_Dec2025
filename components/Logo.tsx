
import React from 'react';

export const Logo: React.FC = () => (
  <div className="flex items-center justify-center space-x-3 py-1">
    <svg
      width="38"
      height="38"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MixMind Logo"
    >
      <path
        d="M27.5,6.88C17.3,7.38,9.5,15.12,9.5,25.38c0,8.62,5.75,16,13.62,18.12"
        stroke="#32A29B"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.25,41.38c-4.25-3.38-6.75-8.62-6.75-14.5"
        stroke="#32A29B"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.12,17.25c3.25-2.88,7.75-4.25,12.38-3.62"
        stroke="#32A29B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.38,25.38c2.12-3.38,5.75-5.62,9.88-5.62"
        stroke="#32A29B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.25,33.5c2.38-1.5,5-2.38,7.88-2.38"
        stroke="#32A29B"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M28.12,25.38h10" stroke="#1A1628" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38.12,25.38l5-5" stroke="#1A1628" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="45.62" cy="17.88" r="4.5" fill="#EC7200" />
    </svg>
    <div>
      <h1 className="text-2xl font-bold text-[#1A1628] tracking-tight leading-none">
        <span className="font-semibold">Mix</span>Mind
      </h1>
      <p className="text-xs text-gray-500 tracking-wide mt-0.5">From Data to Decisions</p>
    </div>
  </div>
);
