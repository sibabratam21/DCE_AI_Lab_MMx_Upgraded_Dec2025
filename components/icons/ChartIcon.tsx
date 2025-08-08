
import React from 'react';

export const ChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3.75M3.75 14.25m-1.5 0h3m-3 0h3m-3 0h-3m1.5 0v3m0 0v-3m0 0h3m-3 0h3m12-11.25h2.25M15 12h.01M12 12h.01M9 12h.01M6 12h.01M6 9h.01M9 9h.01M12 9h.01M15 9h.01" />
  </svg>
);
