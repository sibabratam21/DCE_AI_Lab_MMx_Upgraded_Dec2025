import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
  completedSteps: Set<AppStep>;
  onStepClick: (step: AppStep) => void;
}

const displaySteps = [
  { id: AppStep.Welcome, name: 'Start' },
  { id: AppStep.DataValidation, name: 'Validate' },
  { id: AppStep.FeatureEngineering, name: 'Features' },
  { id: AppStep.Modeling, name: 'Model' },
  { id: AppStep.Report, name: 'Report' },
  { id: AppStep.Optimize, name: 'Optimize' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, completedSteps, onStepClick }) => {
    
  const currentIndex = displaySteps.findIndex(s => s.id === currentStep);

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center justify-center space-x-4 md:space-x-8">
        {displaySteps.map((step, stepIdx) => {
          const isComplete = completedSteps.has(step.id);
          const isCurrent = stepIdx === currentIndex;
          const isClickable = isComplete && !isCurrent;

          return (
            <li key={step.name} className="relative">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`step-button-nav text-sm font-medium transition-colors duration-300 disabled:cursor-not-allowed ${
                  isCurrent ? 'text-gray-900' : isComplete ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {step.name}
              </button>
              {isCurrent && (
                <div 
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-full h-0.5 bg-[#EC7200]"
                  style={{
                    filter: 'blur(3px)',
                    backgroundColor: 'var(--color-orange)'
                  }}
                />
              )}
               {isCurrent && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-3/4 h-0.5" style={{backgroundColor: 'var(--color-orange)'}} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};