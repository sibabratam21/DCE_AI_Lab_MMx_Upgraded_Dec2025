import React, { useState, useEffect } from 'react';
import { Loader } from './Loader';

interface Stage {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  status: 'pending' | 'active' | 'completed';
}

interface StagedModelTrainingProps {
  isActive: boolean;
  onComplete: () => void;
  selectedChannels: string[];
  algorithmCount?: number;
}

const TRAINING_STAGES: Stage[] = [
  {
    id: 'data_prep',
    name: 'Data Preparation',
    description: 'Cleaning and preprocessing input data',
    duration: 3,
    status: 'pending'
  },
  {
    id: 'feature_engineering',
    name: 'Feature Engineering', 
    description: 'Applying adstock, lag, and transformation parameters',
    duration: 5,
    status: 'pending'
  },
  {
    id: 'model_training',
    name: 'Model Training',
    description: 'Training multiple regression algorithms',
    duration: 12,
    status: 'pending'
  },
  {
    id: 'validation',
    name: 'Model Validation',
    description: 'Computing diagnostics and performance metrics',
    duration: 4,
    status: 'pending'
  },
  {
    id: 'optimization',
    name: 'Hyperparameter Optimization',
    description: 'Fine-tuning model parameters for best performance',
    duration: 8,
    status: 'pending'
  }
];

export const StagedModelTraining: React.FC<StagedModelTrainingProps> = ({
  isActive,
  onComplete,
  selectedChannels,
  algorithmCount = 3
}) => {
  const [stages, setStages] = useState<Stage[]>(TRAINING_STAGES);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const totalDuration = stages.reduce((sum, stage) => sum + stage.duration, 0);

  useEffect(() => {
    if (!isActive) {
      // Reset when not active
      setStages(TRAINING_STAGES.map(stage => ({ ...stage, status: 'pending' })));
      setCurrentStageIndex(0);
      setStageProgress(0);
      setTotalElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setStageProgress(prev => {
        const newProgress = prev + (100 / stages[currentStageIndex].duration);
        
        if (newProgress >= 100) {
          // Complete current stage
          setStages(prevStages => 
            prevStages.map((stage, idx) => {
              if (idx === currentStageIndex) {
                return { ...stage, status: 'completed' };
              } else if (idx === currentStageIndex + 1) {
                return { ...stage, status: 'active' };
              }
              return stage;
            })
          );

          // Move to next stage or complete
          if (currentStageIndex < stages.length - 1) {
            setCurrentStageIndex(prev => prev + 1);
            return 0;
          } else {
            // All stages complete
            setTimeout(onComplete, 500);
            return 100;
          }
        }

        return newProgress;
      });

      setTotalElapsed(prev => prev + 1);
    }, 1000);

    // Mark first stage as active
    if (currentStageIndex === 0 && stages[0].status === 'pending') {
      setStages(prevStages => 
        prevStages.map((stage, idx) => 
          idx === 0 ? { ...stage, status: 'active' } : stage
        )
      );
    }

    return () => clearInterval(interval);
  }, [isActive, currentStageIndex, onComplete, stages]);

  if (!isActive) return null;

  const overallProgress = ((currentStageIndex + (stageProgress / 100)) / stages.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6">
        <div className="text-center mb-6">
          <Loader />
          <h2 className="text-2xl font-bold text-gray-900 mt-4">Training Models</h2>
          <p className="text-gray-600 mt-2">
            Building {algorithmCount} algorithms for {selectedChannels.length} channels
          </p>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {Math.floor(totalElapsed / 60)}:{(totalElapsed % 60).toString().padStart(2, '0')} / ~{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#EC7200] h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Stage List */}
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div 
              key={stage.id}
              className={`flex items-start space-x-4 p-4 rounded-lg transition-colors ${
                stage.status === 'active' ? 'bg-blue-50 border border-blue-200' :
                stage.status === 'completed' ? 'bg-green-50 border border-green-200' :
                'bg-gray-50 border border-gray-200'
              }`}
            >
              {/* Status Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stage.status === 'active' ? 'bg-blue-500 text-white' :
                stage.status === 'completed' ? 'bg-green-500 text-white' :
                'bg-gray-300 text-gray-600'
              }`}>
                {stage.status === 'completed' ? '✓' : 
                 stage.status === 'active' ? '⚡' : 
                 index + 1}
              </div>

              {/* Stage Info */}
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <h3 className={`font-medium ${
                    stage.status === 'active' ? 'text-blue-900' :
                    stage.status === 'completed' ? 'text-green-900' :
                    'text-gray-700'
                  }`}>
                    {stage.name}
                  </h3>
                  {stage.status === 'active' && (
                    <span className="text-xs text-blue-600">
                      {Math.floor(stageProgress)}%
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${
                  stage.status === 'active' ? 'text-blue-700' :
                  stage.status === 'completed' ? 'text-green-700' :
                  'text-gray-500'
                }`}>
                  {stage.description}
                </p>

                {/* Stage Progress Bar */}
                {stage.status === 'active' && (
                  <div className="mt-3">
                    <div className="w-full bg-blue-200 rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${stageProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Channel Info */}
        <div className="mt-6 p-3 bg-gray-100 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Channels</h4>
          <div className="flex flex-wrap gap-1">
            {selectedChannels.slice(0, 8).map(channel => (
              <span 
                key={channel}
                className="px-2 py-1 bg-white text-xs text-gray-600 rounded border"
              >
                {channel}
              </span>
            ))}
            {selectedChannels.length > 8 && (
              <span className="px-2 py-1 bg-white text-xs text-gray-500 rounded border">
                +{selectedChannels.length - 8} more
              </span>
            )}
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            This process cannot be interrupted. Please wait while we build your models.
          </p>
        </div>
      </div>
    </div>
  );
};