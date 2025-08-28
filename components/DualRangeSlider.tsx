import React, { useState, useRef, useCallback } from 'react';
import { ParameterRange } from '../types';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: ParameterRange;
  onChange: (value: ParameterRange) => void;
  formatValue?: (value: number) => string;
  label: string;
  isLocked?: boolean;
  onLockChange?: (locked: boolean) => void;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  formatValue = (v) => v.toString(),
  label,
  isLocked = false,
  onLockChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMinChange = useCallback((newMin: number) => {
    const clampedMin = Math.max(min, Math.min(newMin, value.max));
    onChange({ ...value, min: clampedMin });
  }, [min, value, onChange]);

  const handleMaxChange = useCallback((newMax: number) => {
    const clampedMax = Math.min(max, Math.max(newMax, value.min));
    onChange({ ...value, max: clampedMax });
  }, [max, value, onChange]);

  const handleLockToggle = useCallback(() => {
    if (onLockChange) {
      if (!isLocked) {
        const avgValue = (value.min + value.max) / 2;
        const rounded = Math.round(avgValue / step) * step;
        onChange({ min: rounded, max: rounded });
      }
      onLockChange(!isLocked);
    }
  }, [isLocked, onLockChange, value, onChange, step]);

  const handleLockedValueChange = useCallback((newValue: number) => {
    if (isLocked) {
      onChange({ min: newValue, max: newValue });
    }
  }, [isLocked, onChange]);

  const percentMin = ((value.min - min) / (max - min)) * 100;
  const percentMax = ((value.max - min) / (max - min)) * 100;

  const rangeWidth = Math.abs(value.max - value.min);
  const totalRange = max - min;
  const isRangeNarrow = rangeWidth < totalRange * 0.1;
  const isRangeWide = rangeWidth > totalRange * 0.8;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {onLockChange && (
          <button
            onClick={handleLockToggle}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              isLocked 
                ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
            title={isLocked ? 'Unlock to set range' : 'Lock to single value'}
          >
            {isLocked ? '🔒 Locked' : '🔓 Range'}
          </button>
        )}
      </div>

      {isLocked ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value.min}
              onChange={(e) => handleLockedValueChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-thumb"
            />
            <span className="font-mono text-gray-700 w-16 text-center">
              {formatValue(value.min)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <div 
              ref={trackRef}
              className="relative w-full h-2 bg-gray-200 rounded-lg"
            >
              <div 
                className="absolute h-2 bg-orange-400 rounded-lg"
                style={{
                  left: `${percentMin}%`,
                  width: `${percentMax - percentMin}%`
                }}
              />
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value.min}
                onChange={(e) => handleMinChange(parseFloat(e.target.value))}
                className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer range-thumb pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
              />
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value.max}
                onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
                className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer range-thumb pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Min:</label>
              <input
                type="number"
                min={min}
                max={value.max}
                step={step}
                value={value.min}
                onChange={(e) => handleMinChange(parseFloat(e.target.value))}
                className="w-16 px-1 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Max:</label>
              <input
                type="number"
                min={value.min}
                max={max}
                step={step}
                value={value.max}
                onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
                className="w-16 px-1 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
          </div>

          {(isRangeNarrow || isRangeWide) && (
            <div className={`text-xs px-2 py-1 rounded ${
              isRangeNarrow ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {isRangeNarrow && '⚠️ Very narrow range - consider expanding for better model exploration'}
              {isRangeWide && '💡 Wide range - model will explore many parameter values'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};