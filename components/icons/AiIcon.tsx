
import React from 'react';

export const AiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12,2A10,10,0,0,0,2,12A10,10,0,0,0,12,22A10,10,0,0,0,22,12A10,10,0,0,0,12,2ZM11,6H13V8H11V6ZM11,10H13V16H11V10Z" />
    <circle cx="12" cy="12" r="2" />
    <path d="M7,12a5,5,0,0,1,5-5V5A7,7,0,0,0,5,12Z" />
    <path d="M12,17a5,5,0,0,1-5-5H5A7,7,0,0,0,12,19Z" />
  </svg>
);
