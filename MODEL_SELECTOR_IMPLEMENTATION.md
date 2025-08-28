# Model Selector Implementation - Single Source of Truth

## Overview
Implemented a single source of truth for the Model details panel using a selector pattern that ensures data consistency across model, contributions, and diagnostics.

## Key Components

### 1. `eqSet` Utility Function
```typescript
export const eqSet = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};
```
- Compares two sets for equality regardless of element order
- Returns `true` only if both sets contain exactly the same elements
- Used to verify channel consistency across data sources

### 2. `selectActiveModelView` Selector
```typescript
selectActiveModelView(
  activeModelId: string | null,
  modelById: ModelById,
  contributionsById: ContributionsById,
  diagnosticsById: DiagnosticsById
): ActiveModelView
```

**Inputs:**
- `activeModelId`: Currently selected model ID
- `modelById`: Map of model IDs to model data
- `contributionsById`: Map of model IDs to contribution data
- `diagnosticsById`: Map of model IDs to diagnostic data

**Output:**
```typescript
interface ActiveModelView {
  model: ModelRun | null;
  contrib: ContributionData | null;
  diag: DiagnosticData | null;
  consistent: boolean;
  inconsistencyReason?: string;
}
```

**Consistency Rules:**
- `consistent = true` only if:
  - All three data sources exist for the active model ID
  - Channel sets are equal across all three sources: 
    - `eqSet(model.channels, contrib.channels)`
    - `eqSet(model.channels, diag.channels)`

### 3. EnhancedModelDetails Component Integration

The component now:
1. Uses the selector to get a consistent view of the data
2. Shows a warning callout when `consistent === false`
3. Hides both chart and table when data is inconsistent
4. Provides "Recalibrate Now" CTA for recovery
5. Logs warnings to console in development mode

```typescript
// Use selector for single source of truth
const modelView = useMemo(() => {
  const { modelById, contributionsById, diagnosticsById } = createModelDataStores(models);
  return selectActiveModelView(model.id, modelById, contributionsById, diagnosticsById);
}, [model.id, models]);

// Check data consistency
if (!modelView.consistent) {
  return (
    <div className="glass-pane p-6 h-full flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔄</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Data Inconsistency Detected</h3>
        <p className="text-gray-600 mb-2">Model data is not properly synchronized.</p>
        <p className="text-sm text-gray-500 mb-4">{modelView.inconsistencyReason}</p>
        <button onClick={onRecalibrate}>Recalibrate Now</button>
      </div>
    </div>
  );
}
```

## Test Coverage

### eqSet Tests
✅ Returns true for equal sets with different order
✅ Returns false for different sizes
✅ Returns false for different elements
✅ Handles empty sets correctly
✅ Works with numeric sets

### selectActiveModelView Tests
✅ Returns consistent=true when all data matches
✅ Returns consistent=false when model is missing
✅ Returns consistent=false when contributions are missing
✅ Returns consistent=false when diagnostics are missing
✅ Returns consistent=false when channels mismatch
✅ Returns consistent=false for null activeModelId
✅ Handles channel order differences correctly (still consistent)
✅ Logs warnings in development mode

## Demo Scenarios

1. **Consistent Model**: All three data sources exist with matching channels
   - Result: `consistent = true`

2. **Inconsistent Channels**: Model has different channels than contributions/diagnostics
   - Result: `consistent = false`
   - Reason: "Channel mismatch - Model: [TV, Radio, Digital], Contributions: [TV, Radio, Social]..."

3. **Missing Data**: One or more data sources missing
   - Result: `consistent = false`
   - Reason: "Missing data: diagnostics"

4. **No Selection**: activeModelId is null
   - Result: `consistent = false`
   - Reason: "No model selected"

## Benefits

1. **Data Integrity**: Ensures all displayed data comes from consistent sources
2. **Error Prevention**: Catches data mismatches before they cause rendering errors
3. **User Feedback**: Clear messaging when data needs recalibration
4. **Developer Experience**: Console warnings help catch regressions during development
5. **Maintainability**: Single source of truth makes data flow predictable

## Files Modified

- `services/modelSelectors.ts` - Core selector implementation
- `services/modelSelectors.test.ts` - Comprehensive test suite
- `services/modelSelectors.demo.ts` - Interactive demo script
- `components/EnhancedModelDetails.tsx` - Updated to use selector
- `components/ModelingView.tsx` - Passes models prop for data stores

## Usage Example

```typescript
// In component
const modelView = useMemo(() => {
  const { modelById, contributionsById, diagnosticsById } = createModelDataStores(models);
  return selectActiveModelView(activeModelId, modelById, contributionsById, diagnosticsById);
}, [activeModelId, models]);

// Use consistent data
if (modelView.consistent) {
  // Render chart using modelView.contrib
  // Render diagnostics using modelView.diag
  // Access model via modelView.model
}
```