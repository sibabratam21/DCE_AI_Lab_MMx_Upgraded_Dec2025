import { useState, useEffect, useRef, useCallback } from 'react';

export type ModelStage = 'Preparing' | 'Training' | 'Scoring';

export interface ModelProgressState {
  loading: boolean;
  stage: ModelStage;
  label: string;
  progress: number; // 0-100
}

interface StageConfig {
  name: ModelStage;
  label: string;
  minDuration: [number, number]; // [min, max] in milliseconds
  progress: number; // Target progress percentage
}

const STAGES: StageConfig[] = [
  {
    name: 'Preparing',
    label: 'Preparing data and features...',
    minDuration: [300, 500],
    progress: 20
  },
  {
    name: 'Training', 
    label: 'Training models with selected parameters...',
    minDuration: [1200, 1800],
    progress: 70
  },
  {
    name: 'Scoring',
    label: 'Scoring models and generating diagnostics...',
    minDuration: [300, 500], 
    progress: 100
  }
];

/**
 * Hook for managing staged model training progress with randomized durations
 * and abort support
 */
export const useModelProgress = (triggerKey: string | number) => {
  const [state, setState] = useState<ModelProgressState>({
    loading: false,
    stage: 'Preparing',
    label: '',
    progress: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const stageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchPromiseRef = useRef<Promise<any> | null>(null);
  const stageStartTimeRef = useRef<number>(0);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback((newState: Partial<ModelProgressState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...newState }));
    }
  }, []);

  // Generate random duration within range
  const getRandomDuration = useCallback((range: [number, number]) => {
    const [min, max] = range;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (stageTimeoutRef.current) {
      clearTimeout(stageTimeoutRef.current);
      stageTimeoutRef.current = null;
    }
    fetchPromiseRef.current = null;
  }, []);

  // Execute a stage with minimum duration enforcement
  const executeStage = useCallback(async (
    stageIndex: number, 
    fetchFunction?: () => Promise<any>
  ): Promise<void> => {
    const stage = STAGES[stageIndex];
    if (!stage) return;

    stageStartTimeRef.current = Date.now();
    const minDuration = getRandomDuration(stage.minDuration);
    
    console.log(`[ModelProgress] Starting ${stage.name} stage (min: ${minDuration}ms)`);

    // Update to current stage
    safeSetState({
      stage: stage.name,
      label: stage.label,
      progress: stageIndex === 0 ? 0 : STAGES[stageIndex - 1].progress
    });

    // Animate progress during stage
    const progressInterval = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(progressInterval);
        return;
      }
      
      const elapsed = Date.now() - stageStartTimeRef.current;
      const progressPercent = Math.min(elapsed / minDuration, 1);
      const startProgress = stageIndex === 0 ? 0 : STAGES[stageIndex - 1].progress;
      const endProgress = stage.progress;
      const currentProgress = startProgress + (endProgress - startProgress) * progressPercent;
      
      safeSetState({ progress: Math.min(currentProgress, endProgress) });
    }, 50);

    try {
      // For Training stage, start the fetch and wait for both fetch + timer
      if (stage.name === 'Training' && fetchFunction) {
        console.log('[ModelProgress] Starting fetch during Training stage');
        
        // Start fetch immediately
        fetchPromiseRef.current = fetchFunction();
        
        // Wait for both minimum duration AND fetch completion
        const [, fetchResult] = await Promise.all([
          new Promise(resolve => {
            stageTimeoutRef.current = setTimeout(resolve, minDuration);
          }),
          fetchPromiseRef.current
        ]);

        clearInterval(progressInterval);
        
        if (isMountedRef.current) {
          safeSetState({ progress: stage.progress });
          console.log(`[ModelProgress] Training stage completed with fetch result`);
        }
        
        return fetchResult;
      } else {
        // For other stages, just wait the minimum duration
        await new Promise(resolve => {
          stageTimeoutRef.current = setTimeout(resolve, minDuration);
        });
        
        clearInterval(progressInterval);
        
        if (isMountedRef.current) {
          safeSetState({ progress: stage.progress });
          console.log(`[ModelProgress] ${stage.name} stage completed`);
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[ModelProgress] ${stage.name} stage aborted`);
        throw error;
      }
      throw error;
    }
  }, [safeSetState, getRandomDuration]);

  // Main execution function
  const executeWithProgress = useCallback(async (fetchFunction: () => Promise<any>) => {
    if (state.loading) {
      console.log('[ModelProgress] Already loading, ignoring new request');
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      safeSetState({ loading: true, progress: 0 });

      // Execute stages sequentially
      await executeStage(0); // Preparing
      
      if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }
      
      const fetchResult = await executeStage(1, fetchFunction); // Training (with fetch)
      
      if (abortControllerRef.current?.signal.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }
      
      await executeStage(2); // Scoring
      
      if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
        safeSetState({ 
          loading: false, 
          stage: 'Scoring',
          label: 'Models ready!',
          progress: 100 
        });
        console.log('[ModelProgress] All stages completed successfully');
      }
      
      return fetchResult;
      
    } catch (error) {
      if (isMountedRef.current) {
        if (error instanceof Error && error.name === 'AbortError') {
          safeSetState({ 
            loading: false, 
            stage: 'Preparing',
            label: 'Training cancelled',
            progress: 0 
          });
          console.log('[ModelProgress] Training aborted cleanly');
        } else {
          safeSetState({ 
            loading: false, 
            stage: 'Preparing', 
            label: 'Training failed',
            progress: 0 
          });
          console.error('[ModelProgress] Training failed:', error);
        }
      }
      throw error;
    } finally {
      cleanup();
    }
  }, [state.loading, safeSetState, executeStage, cleanup]);

  // Abort current operation
  const abort = useCallback(() => {
    console.log('[ModelProgress] Aborting current operation');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Effect to handle triggerKey changes (tab navigation)
  useEffect(() => {
    // Abort any ongoing operation when triggerKey changes
    if (state.loading) {
      console.log('[ModelProgress] Trigger key changed, aborting current operation');
      abort();
    }
  }, [triggerKey, state.loading, abort]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    executeWithProgress,
    abort,
    isAborted: abortControllerRef.current?.signal.aborted ?? false
  };
};