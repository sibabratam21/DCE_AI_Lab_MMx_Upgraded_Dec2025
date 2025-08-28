/**
 * Unit tests for moving average utility
 */

import { movingAverage, createDatasetHash } from './smooth';

describe('movingAverage', () => {
  it('handles empty array', () => {
    expect(movingAverage([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(movingAverage([5])).toEqual([5]);
  });

  it('handles window size 1 (no smoothing)', () => {
    expect(movingAverage([1, 2, 3, 4], 1)).toEqual([1, 2, 3, 4]);
  });

  it('calculates centered moving average with window=4', () => {
    // Test data: [1, 2, 3, 4, 5, 6] with window=4 (halfWindow=2)
    // For i=0: start=0, end=3, window=[1,2,3] -> avg=2
    // For i=1: start=0, end=4, window=[1,2,3,4] -> avg=2.5
    // For i=2: start=0, end=5, window=[1,2,3,4,5] -> avg=3
    // For i=3: start=1, end=6, window=[2,3,4,5,6] -> avg=4
    // For i=4: start=2, end=6, window=[3,4,5,6] -> avg=4.5
    // For i=5: start=3, end=6, window=[4,5,6] -> avg=5
    const result = movingAverage([1, 2, 3, 4, 5, 6], 4);
    expect(result).toEqual([2, 2.5, 3, 4, 4.5, 5]);
  });

  it('handles partial windows at edges correctly', () => {
    // Edge case with small array and larger window
    const result = movingAverage([10, 20, 30], 4);
    // For i=0,1,2: start=0, end=3, window=[10,20,30] -> avg=20
    expect(result).toEqual([20, 20, 20]);
  });

  it('handles NaN values correctly', () => {
    // Array with NaN: [1, NaN, 3, 4] with window=4
    // For i=0: start=0, end=3, window=[1,NaN,3] -> filters to [1,3] -> avg=2
    // For i=1: start=0, end=4, window=[1,NaN,3,4] -> filters to [1,3,4] -> avg=8/3≈2.67
    // For i=2: start=0, end=4, window=[1,NaN,3,4] -> filters to [1,3,4] -> avg=8/3≈2.67
    // For i=3: start=1, end=4, window=[NaN,3,4] -> filters to [3,4] -> avg=3.5
    const result = movingAverage([1, NaN, 3, 4], 4);
    expect(result).toEqual([2, 8/3, 8/3, 3.5]);
  });

  it('returns NaN when entire window contains only NaN values', () => {
    const result = movingAverage([NaN, NaN, 1, NaN], 4);
    // For i=0: window=[NaN, NaN] -> all NaN -> NaN
    // For i=1: window=[NaN, NaN, 1] -> filters to [1] -> avg=1
    // For i=2: window=[NaN, NaN, 1, NaN] -> filters to [1] -> avg=1
    // For i=3: window=[NaN, 1, NaN] -> filters to [1] -> avg=1
    expect(result[0]).toBeNaN();
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(1);
    expect(result[3]).toBe(1);
  });

  it('handles null and undefined values', () => {
    const result = movingAverage([1, null, undefined, 4], 4);
    // For i=0: window=[1, null] -> filters to [1] -> avg=1
    // For i=1: window=[1, null, undefined] -> filters to [1] -> avg=1
    // For i=2: window=[1, null, undefined, 4] -> filters to [1, 4] -> avg=2.5
    // For i=3: window=[null, undefined, 4] -> filters to [4] -> avg=4
    expect(result).toEqual([1, 1, 2.5, 4]);
  });
});

describe('createDatasetHash', () => {
  it('handles empty array', () => {
    expect(createDatasetHash([])).toBe('empty');
  });

  it('creates consistent hash for same data', () => {
    const data1 = [{ kpi: 100, date: '2023-01-01' }, { kpi: 200, date: '2023-01-02' }];
    const data2 = [{ kpi: 100, date: '2023-01-01' }, { kpi: 200, date: '2023-01-02' }];
    
    expect(createDatasetHash(data1)).toBe(createDatasetHash(data2));
  });

  it('creates different hash for different data', () => {
    const data1 = [{ kpi: 100 }, { kpi: 200 }];
    const data2 = [{ kpi: 300 }, { kpi: 400 }];
    
    expect(createDatasetHash(data1)).not.toBe(createDatasetHash(data2));
  });
});