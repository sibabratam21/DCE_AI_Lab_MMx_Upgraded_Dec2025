/**
 * Tests for useModelProgress hook - staged loader with timing and abort behavior
 */

import React from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { useModelProgress } from './useModelProgress';

// Mock timers for testing
jest.useFakeTimers();

describe('useModelProgress Hook', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useModelProgress('test-key'));

      expect(result.current.loading).toBe(false);
      expect(result.current.stage).toBe('Preparing');
      expect(result.current.label).toBe('');
      expect(result.current.progress).toBe(0);
      expect(result.current.isAborted).toBe(false);
    });
  });

  describe('Stage Progression', () => {
    it('should progress through all three stages in correct order', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      const mockFetchFn = jest.fn().mockResolvedValue('mock-result');

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);
      expect(result.current.stage).toBe('Preparing');
      expect(result.current.label).toBe('Preparing data and features...');

      // Fast-forward through Preparing stage (300-500ms min)
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Training');
        expect(result.current.label).toBe('Training models with selected parameters...');
      });

      // Fast-forward through Training stage (1200-1800ms min)
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Scoring');
        expect(result.current.label).toBe('Scoring models and generating diagnostics...');
      });

      // Fast-forward through Scoring stage (300-500ms min)
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.label).toBe('Models ready!');
        expect(result.current.progress).toBe(100);
      });

      // Verify fetch was called during Training stage
      expect(mockFetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Training Stage Duration', () => {
    it('should enforce minimum duration of 1.2s for Training stage', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      
      // Fast-resolving fetch function
      const fastFetchFn = jest.fn().mockResolvedValue('fast-result');
      const startTime = Date.now();

      // Start the process
      act(() => {
        result.current.executeWithProgress(fastFetchFn);
      });

      // Fast-forward through Preparing stage
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Training');
      });

      const trainingStartTime = Date.now();

      // Fast-forward just under minimum duration (1.2s = 1200ms)
      act(() => {
        jest.advanceTimersByTime(1100);
      });

      // Should still be in Training stage
      expect(result.current.stage).toBe('Training');
      expect(result.current.loading).toBe(true);

      // Fast-forward to meet minimum duration
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Scoring');
      });

      // Verify Training stage lasted at least 1.2s
      const trainingDuration = Date.now() - trainingStartTime;
      expect(trainingDuration).toBeGreaterThanOrEqual(1200);
    });

    it('should wait for both fetch completion and minimum timer', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      
      let resolveFetch: (value: any) => void;
      const slowFetchFn = jest.fn(() => new Promise(resolve => {
        resolveFetch = resolve;
      }));

      // Start the process
      act(() => {
        result.current.executeWithProgress(slowFetchFn);
      });

      // Get to Training stage
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Training');
      });

      // Fast-forward past minimum Training duration
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should still be in Training stage (waiting for fetch)
      expect(result.current.stage).toBe('Training');
      expect(result.current.loading).toBe(true);

      // Now resolve the fetch
      act(() => {
        resolveFetch!('slow-result');
      });

      // Should immediately proceed to Scoring
      await waitFor(() => {
        expect(result.current.stage).toBe('Scoring');
      });
    });
  });

  describe('Abort Functionality', () => {
    it('should abort cleanly when abort() is called', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      const mockFetchFn = jest.fn().mockResolvedValue('mock-result');

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      expect(result.current.loading).toBe(true);

      // Abort during execution
      act(() => {
        result.current.abort();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.label).toBe('Training cancelled');
        expect(result.current.progress).toBe(0);
      });
    });

    it('should abort when triggerKey changes (simulating navigation)', async () => {
      const { result, rerender } = renderHook(
        ({ triggerKey }) => useModelProgress(triggerKey),
        { initialProps: { triggerKey: 'modeling' } }
      );
      
      const mockFetchFn = jest.fn().mockResolvedValue('mock-result');

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      expect(result.current.loading).toBe(true);

      // Simulate navigation by changing triggerKey
      rerender({ triggerKey: 'optimization' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.label).toBe('Training cancelled');
      });
    });

    it('should handle AbortError gracefully', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      
      const abortingFetchFn = jest.fn().mockImplementation(() => {
        throw new DOMException('Operation aborted', 'AbortError');
      });

      let caughtError: any;
      
      try {
        await act(async () => {
          await result.current.executeWithProgress(abortingFetchFn);
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(DOMException);
      expect(caughtError.name).toBe('AbortError');
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.label).toBe('Training cancelled');
      });
    });
  });

  describe('Cleanup on Unmount', () => {
    it('should cleanup resources when component unmounts', async () => {
      const { result, unmount } = renderHook(() => useModelProgress('test-key'));
      const mockFetchFn = jest.fn().mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      expect(result.current.loading).toBe(true);

      // Unmount the component
      unmount();

      // Should not crash or cause memory leaks
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // No assertions needed - this test passes if no errors are thrown
    });

    it('should guard against setState after unmount', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { result, unmount } = renderHook(() => useModelProgress('test-key'));
      const mockFetchFn = jest.fn().mockResolvedValue('result');

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      // Unmount immediately
      unmount();

      // Advance timers to trigger potential state updates
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should not have any React warnings about setState after unmount
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('setState')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Progress Animation', () => {
    it('should animate progress smoothly through stages', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      const mockFetchFn = jest.fn().mockResolvedValue('mock-result');

      // Start the process
      act(() => {
        result.current.executeWithProgress(mockFetchFn);
      });

      // Initially at 0
      expect(result.current.progress).toBe(0);

      // Advance partway through Preparing stage
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Progress should be between 0 and 20 (Preparing target)
      expect(result.current.progress).toBeGreaterThan(0);
      expect(result.current.progress).toBeLessThan(20);

      // Complete Preparing stage
      act(() => {
        jest.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(result.current.stage).toBe('Training');
        expect(result.current.progress).toBe(20);
      });

      // Advance partway through Training stage
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Progress should be between 20 and 70 (Training target)
      expect(result.current.progress).toBeGreaterThan(20);
      expect(result.current.progress).toBeLessThan(70);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const { result } = renderHook(() => useModelProgress('test-key'));
      
      const failingFetchFn = jest.fn().mockRejectedValue(new Error('Network error'));

      let caughtError: any;
      
      try {
        await act(async () => {
          await result.current.executeWithProgress(failingFetchFn);
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Network error');
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.label).toBe('Training failed');
      });
    });
  });
});