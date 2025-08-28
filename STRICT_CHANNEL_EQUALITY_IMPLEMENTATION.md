# Strict Channel Equality Implementation

## Summary
Applied strict channel equality globally to ensure data integrity across the Model tab, with automatic stale state detection and clear user warnings.

## Key Changes

### 1. Global Channel Utilities (`utils/channelUtils.ts`)
```typescript
// BEFORE: Lenient matching, scattered implementations
// AFTER: Centralized strict equality functions

export const eqSet = <T>(a: Set<T>, b: Set<T>): boolean => {
  return a.size === b.size && [...a].every(x => b.has(x));
};

export const channelsMatch = (model: ModelRun, selectedChannels: string[]): boolean => {
  if (!model?.channels) return false;
  return eqSet(new Set(model.channels), new Set(selectedChannels));
};
```

### 2. Enhanced Model Leaderboard Changes

#### Before:
```typescript
// Lenient channel matching with backward compatibility
if (model.channels) {
  const channelMatch = eqSet(model.channels, selectedChannels);
  if (!channelMatch) return false;
}
// If no channels property, assume it matches

// Legacy ON by default
showLegacy: true
```

#### After:
```typescript
// STRICT Channel matching - must have exact match
const hasChannelMatch = channelsMatch(model, selectedChannels);
if (!hasChannelMatch) {
  if (!filters.showLegacy) {
    return false; // Exclude unless legacy mode is ON
  }
}

// Legacy OFF by default for safety
showLegacy: false

// Enhanced legacy toggle with warning
<label className="font-medium text-orange-700 flex items-center gap-1">
  <span>⚠️</span>
  <span>Show legacy results (unsafe - mismatched channels/params)</span>
</label>
```

### 3. Enhanced Model Details Stale Detection

#### Before:
```typescript
// Only checked provenance-based staleness
if (isStale) {
  return <div>Selections changed</div>;
}
```

#### After:
```typescript
// Check for channel mismatch
useEffect(() => {
  const mismatch = !channelsMatch(model, selectedChannels);
  setLocalChannelMismatch(mismatch);
  if (mismatch) {
    console.warn(`[ModelDetails] Channel mismatch detected...`);
  }
}, [model, selectedChannels]);

// Show specific warnings based on stale reason
if (isStale || localChannelMismatch) {
  return (
    <div className="glass-pane p-6">
      <h3>{localChannelMismatch ? 'Channel Mismatch Detected' : 'Model Parameters Outdated'}</h3>
      <p>{localChannelMismatch 
        ? `This model was trained with: [${model.channels?.join(', ')}]`
        : 'Feature parameters have changed'}</p>
      <p>Current selection: [${selectedChannels.join(', ')}]</p>
      <button onClick={onRecalibrate}>Recalibrate Now</button>
    </div>
  );
}
```

## Test Coverage

### Test (a): Row Filtered When Channels Differ
```typescript
describe('filterModelsByChannels', () => {
  it('should filter models with exact channel match', () => {
    const models = [
      { channels: ['TV', 'Radio', 'Digital'] }, // ✓ Matches
      { channels: ['TV', 'Radio', 'Print'] },   // ✗ Different
      { channels: ['TV', 'Radio', 'Digital'] }  // ✓ Matches
    ];
    
    const filtered = filterModelsByChannels(models, ['TV', 'Radio', 'Digital']);
    expect(filtered).toHaveLength(2); // Only matching models
  });
});
```

### Test (b): Stale Overlay Appears on Selection Change
```typescript
describe('Selection Change Triggers Stale', () => {
  it('should become stale when channels are changed', async () => {
    const { rerender } = render(<EnhancedModelDetails {...props} />);
    
    // Initially not stale
    expect(screen.queryByText('Channel Mismatch')).not.toBeInTheDocument();
    
    // Change channels to trigger mismatch
    channelsMatch.mockReturnValue(false);
    rerender(<EnhancedModelDetails selectedChannels={['TV', 'Radio']} />);
    
    // Should now show stale overlay
    await waitFor(() => {
      expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
    });
  });
});
```

## Behavior Matrix

| Scenario | Legacy OFF (default) | Legacy ON |
|----------|---------------------|-----------|
| Channels match exactly | ✅ Show | ✅ Show |
| Channels differ | ❌ Hide | ⚠️ Show with warning |
| Provenance stale | ❌ Hide | ⚠️ Show with warning |
| Both stale + mismatch | ❌ Hide | ⚠️ Show with warning |

## User Experience Flow

1. **Default State**: Only models with exact channel matches are shown
2. **Channel Change**: 
   - Leaderboard automatically filters out mismatched models
   - Details panel shows "Channel Mismatch Detected" overlay
   - Charts and metrics are blocked
3. **Recovery**: 
   - User clicks "Recalibrate Now" to generate new models
   - Or toggles "Show legacy results" with warning label
4. **Legacy Mode**: 
   - Shows ALL models but with clear warning
   - Orange warning icon and text
   - User explicitly accepts risk

## Benefits

1. **Data Integrity**: Prevents showing results for wrong channel sets
2. **Clear Feedback**: Specific messages for channel vs provenance staleness  
3. **Safe Defaults**: Legacy mode OFF by default
4. **User Control**: Explicit opt-in for viewing mismatched models
5. **Developer Warnings**: Console logs help catch issues early

## Files Modified

- `utils/channelUtils.ts` - Global strict equality utilities
- `utils/channelUtils.test.ts` - Comprehensive unit tests
- `components/EnhancedModelLeaderboard.tsx` - Strict filtering with legacy toggle
- `components/EnhancedModelDetails.tsx` - Channel mismatch detection
- `components/EnhancedModelDetails.test.tsx` - Stale overlay behavior tests