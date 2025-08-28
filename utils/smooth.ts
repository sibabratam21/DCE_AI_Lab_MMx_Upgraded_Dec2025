/**
 * Moving average utility for trend smoothing
 */

/**
 * Calculate centered moving average with partial windows at edges
 * @param series Array of numbers to smooth
 * @param window Window size for moving average (default: 4)
 * @returns Smoothed array of the same length
 */
export const movingAverage = (series: number[], window: number = 4): number[] => {
  if (series.length === 0) return [];
  if (window <= 1) return [...series];

  const result = new Array(series.length);
  const halfWindow = Math.floor(window / 2);

  for (let i = 0; i < series.length; i++) {
    // Calculate partial window boundaries
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(series.length, i + halfWindow + 1);
    
    // Extract window values, filtering out NaN/null/undefined
    const windowValues = series.slice(start, end).filter(val => 
      val !== null && val !== undefined && !isNaN(val)
    );
    
    // If all values in window are NaN, return NaN
    if (windowValues.length === 0) {
      result[i] = NaN;
    } else {
      // Calculate average of valid values
      const sum = windowValues.reduce((acc, val) => acc + val, 0);
      result[i] = sum / windowValues.length;
    }
  }

  return result;
};

/**
 * Create a cache key from array content for memoization
 * @param data Array to create hash from
 * @returns String hash of the data
 */
export const createDatasetHash = (data: any[]): string => {
  if (!data || data.length === 0) return 'empty';
  
  // Create a simple hash from first/last/length for performance
  const first = data[0]?.kpi || data[0]?.date || JSON.stringify(data[0]);
  const last = data[data.length - 1]?.kpi || data[data.length - 1]?.date || JSON.stringify(data[data.length - 1]);
  
  return `${data.length}_${first}_${last}`.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
};