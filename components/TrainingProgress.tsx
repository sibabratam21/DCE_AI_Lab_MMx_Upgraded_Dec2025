import React, { useState, useEffect } from 'react';

interface TrainingProgressProps {
  isVisible: boolean;
  onComplete: () => void;
  minDuration?: number; // minimum duration in ms
}

interface ProgressStep {
  id: string;
  label: string;
  duration: number; // duration in ms
}

const PROGRESS_STEPS: ProgressStep[] = [
  { id: 'preparing', label: 'Preparing features...', duration: 900 },
  { id: 'training', label: 'Training candidates...', duration: 1200 },
  { id: 'scoring', label: 'Scoring & ranking...', duration: 800 }
];

export const TrainingProgress: React.FC<TrainingProgressProps> = ({ 
  isVisible, 
  onComplete, 
  minDuration = 2900 
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStepIndex(0);
      setProgress(0);
      setStartTime(null);
      return;
    }

    setStartTime(Date.now());
    let stepTimeouts: NodeJS.Timeout[] = [];
    let progressInterval: NodeJS.Timeout;
    
    const runProgressSequence = () => {
      let totalElapsed = 0;
      
      PROGRESS_STEPS.forEach((step, index) => {
        const timeout = setTimeout(() => {
          setCurrentStepIndex(index);
          setProgress(0);
          
          // Progress animation for current step
          const stepStart = Date.now();
          progressInterval = setInterval(() => {
            const elapsed = Date.now() - stepStart;
            const stepProgress = Math.min(100, (elapsed / step.duration) * 100);
            setProgress(stepProgress);
            
            if (stepProgress >= 100) {
              clearInterval(progressInterval);
            }
          }, 50);
          
        }, totalElapsed);
        
        stepTimeouts.push(timeout);
        totalElapsed += step.duration;
      });
      
      // Final completion timeout
      const completionTimeout = setTimeout(() => {
        const actualDuration = Date.now() - (startTime || 0);
        const remainingTime = Math.max(0, minDuration - actualDuration);
        
        if (remainingTime > 0) {
          // Wait for minimum duration
          setTimeout(() => {
            onComplete();
          }, remainingTime);
        } else {
          onComplete();
        }
      }, totalElapsed);
      
      stepTimeouts.push(completionTimeout);
    };
    
    runProgressSequence();
    
    // Cleanup function
    return () => {
      stepTimeouts.forEach(timeout => clearTimeout(timeout));
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isVisible, onComplete, minDuration, startTime]);

  if (!isVisible) return null;

  const currentStep = PROGRESS_STEPS[currentStepIndex];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#EC7200]/10 rounded-full mb-4">
            <div className="w-8 h-8 border-4 border-[#EC7200] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Training Models</h3>
          <p className="text-gray-600 text-sm">
            Running {PROGRESS_STEPS.length} steps with multiple algorithms...
          </p>
        </div>
        
        <div className="space-y-4">
          {PROGRESS_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isUpcoming = index > currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-[#EC7200] text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                
                <div className="flex-1">
                  <div className={`text-sm font-medium ${
                    isCompleted ? 'text-green-600' :
                    isCurrent ? 'text-[#EC7200]' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </div>
                  
                  {isCurrent && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#EC7200] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 text-center text-xs text-gray-500">
          This process typically takes 2-3 minutes
        </div>
      </div>
    </div>
  );
};