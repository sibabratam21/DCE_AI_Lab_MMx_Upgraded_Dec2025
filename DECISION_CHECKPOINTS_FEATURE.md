# Decision Checkpoint System

## Overview
The Decision Checkpoint System wraps existing confirmation flows with explicit agent checkpoints that summarize and lock critical decisions throughout the MMM workflow. Each checkpoint provides transparency, auditability, and prevents accidental changes to finalized decisions.

## Key Features

### 🔒 Decision Locking
- Locks critical decisions at key workflow stages
- Creates an audit trail in the DecisionLog
- Prevents accidental changes to confirmed settings
- Allows overrides with explicit justification

### ⚠️ Warning System
- Highlights potential issues with visual warnings
- Shows downstream impacts of decisions
- Offers "Proceed Anyway" option with mandatory reasoning
- Logs all overrides with user justification

### 📋 Decision Transparency
- Summarizes items being locked in clear, structured format
- Shows downstream impact of decisions
- Displays warnings prominently
- Provides educational context

## Checkpoint Locations

### 1. **Column Assignment Checkpoint**
**Trigger:** After user confirms column type assignments
**Step:** `AppStep.Configure`

**Items Locked:**
- Dependent Variable (KPI)
- Marketing Spend Channels
- Marketing Activity Channels
- Time Dimension
- Geographic Dimension (if present)
- Control Variables (if present)

**Warnings:**
- Missing dependent variable
- No marketing channels selected
- Missing time dimension

**Downstream Impact:**
- Column assignments determine model structure
- All subsequent analysis (EDA, feature engineering, modeling) uses these assignments
- Changing columns later requires re-running entire workflow

**Decision Log Entry:**
```typescript
{
  step: AppStep.Configure,
  type: 'LOCK',
  summary: 'Locked column assignments',
  details: `User confirmed column types: X dependent variable(s), Y marketing channels, Z controls`,
  status: 'ACTIVE'
}
```

---

### 2. **Channel Approval Checkpoint**
**Trigger:** After user confirms channel approval/exclusion decisions
**Step:** `AppStep.DataValidation`

**Items Locked:**
- Approved Channels (list)
- Excluded Channels (list with warning indicator)

**Warnings:**
- No channels approved
- Channels excluded (always shows warning)

**Downstream Impact:**
- N channels will be included in feature engineering
- Excluded channels will not be part of MMM model
- Feature parameters generated for approved channels only

**Override Option:** Available when channels are excluded or none approved
**Decision Log Entry (Normal):**
```typescript
{
  step: AppStep.DataValidation,
  type: 'LOCK',
  summary: 'Locked channel approval decisions',
  details: `Approved X channels, excluded Y channels. Excluded: [channel names]`,
  status: 'ACTIVE'
}
```

**Decision Log Entry (Override):**
```typescript
{
  step: AppStep.DataValidation,
  type: 'OVERRIDE',
  summary: 'Proceeded with channel selection despite warnings',
  details: `User reason: [reason]. Approved X channels, excluded Y channels.`,
  status: 'ACTIVE'
}
```

---

### 3. **Feature Engineering Checkpoint**
**Trigger:** After user confirms feature engineering parameters
**Step:** `AppStep.FeatureEngineering`

**Items Locked:**
- Per-channel parameters:
  - Adstock range (min-max)
  - Lag range (min-max)
  - Transformation function

**Warnings:** None (parameters are recommendations)

**Downstream Impact:**
- N channels will be modeled with these parameters
- Model training will explore combinations within these ranges
- These settings determine how marketing effects are captured

**Decision Log Entry:**
```typescript
{
  step: AppStep.FeatureEngineering,
  type: 'LOCK',
  summary: 'Locked feature engineering parameters',
  details: `Confirmed parameters for X channels: [channel names]`,
  status: 'ACTIVE'
}
```

---

### 4. **Model Finalization Checkpoint**
**Trigger:** After user confirms model finalization
**Step:** `AppStep.Modeling`

**Items Locked:**
- Model Algorithm (e.g., Bayesian Regression)
- Model Performance (R², MAPE)
- Blended ROI
- Channels Included (list)
- Weak Channels (if any, with warning)

**Warnings:**
- Weak channels (low p-value, high uncertainty)
- Sign mismatches
- Overfit risk

**Downstream Impact:**
- This model will be used for final report and optimization
- Model selection locked and cannot be changed without re-running
- Budget recommendations based on this model's coefficients

**Override Option:** Available when model has diagnostic warnings
**Decision Log Entry (Normal):**
```typescript
{
  step: AppStep.Modeling,
  type: 'LOCK',
  summary: `Finalized model [model_id]`,
  details: `Model: [algo], R²: X%, MAPE: Y%, ROI: Zx`,
  status: 'ACTIVE'
}
```

**Decision Log Entry (Override):**
```typescript
{
  step: AppStep.Modeling,
  type: 'OVERRIDE',
  summary: `Finalized model [model_id] despite warnings`,
  details: `User reason: [reason]. Model: [algo], Weak channels: [channels]`,
  status: 'ACTIVE'
}
```

## Component Architecture

### DecisionCheckpointModal.tsx

**Props:**
```typescript
interface DecisionCheckpointModalProps {
  isOpen: boolean;                          // Modal visibility
  title: string;                            // Checkpoint title
  step: AppStep;                            // Current workflow step
  itemsBeingLocked: CheckpointItem[];       // Items to lock
  downstreamImpact: string[];               // Impact descriptions
  onLockAndProceed: () => void;             // Confirm handler
  onEdit: () => void;                       // Go back handler
  onProceedAnyway?: (reason: string) => void; // Override handler
  allowProceedAnyway?: boolean;             // Enable override option
}

interface CheckpointItem {
  label: string;    // Item name
  value: string;    // Item value/description
  isWarning?: boolean; // Show warning indicator
}
```

**Visual Design:**
- Modal overlay with backdrop
- Header with icon (🔒 normal, ⚠️ warnings)
- Items section with cards
- Downstream impact section
- Warning messages (if applicable)
- Override reason input (conditional)
- Footer with action buttons

**Actions:**
1. **Lock & Proceed** (Green button)
   - Confirms all items
   - Logs decision to DecisionLog
   - Locks decision
   - Proceeds to next step

2. **Go Back & Edit** (Secondary button)
   - Closes modal
   - Returns to previous state
   - Allows user to modify selections

3. **Proceed Anyway** (Purple button, conditional)
   - Shows when warnings present and override allowed
   - Requires detailed reason (minimum 10 characters)
   - Logs OVERRIDE decision with user reason
   - Proceeds despite warnings

## Integration Pattern

### App.tsx Integration

**State:**
```typescript
const [checkpointModalConfig, setCheckpointModalConfig] = useState({
  isOpen: false,
  title: '',
  step: AppStep.Welcome,
  items: [],
  impact: [],
  onConfirm: () => {},
  onEdit: () => {}
});
```

**Helper Functions:**
```typescript
const showCheckpoint = useCallback((config) => {
  setCheckpointModalConfig({ isOpen: true, ...config });
}, []);

const closeCheckpoint = useCallback(() => {
  setCheckpointModalConfig(prev => ({ ...prev, isOpen: false }));
}, []);
```

**Render:**
```tsx
<DecisionCheckpointModal
  isOpen={checkpointModalConfig.isOpen}
  title={checkpointModalConfig.title}
  step={checkpointModalConfig.step}
  itemsBeingLocked={checkpointModalConfig.items}
  downstreamImpact={checkpointModalConfig.impact}
  onLockAndProceed={checkpointModalConfig.onConfirm}
  onEdit={checkpointModalConfig.onEdit}
  onProceedAnyway={checkpointModalConfig.onOverride}
  allowProceedAnyway={checkpointModalConfig.allowOverride}
/>
```

## Usage Example

### Column Confirmation Flow

**Before (Direct Confirmation):**
```typescript
if (confirmation === 'affirmative') {
  setAwaitingColumnConfirmation(false);
  await handleProceedWithColumnSelection();
}
```

**After (With Checkpoint):**
```typescript
if (confirmation === 'affirmative') {
  setAwaitingColumnConfirmation(false);

  // Build checkpoint items
  const checkpointItems: CheckpointItem[] = [
    { label: 'Dependent Variable', value: dependentVars.join(', '), isWarning: dependentVars.length === 0 },
    { label: 'Marketing Spend', value: spendChannels.join(', '), isWarning: spendChannels.length === 0 },
    // ... more items
  ];

  // Show checkpoint
  showCheckpoint({
    title: 'Lock Column Assignments',
    step: AppStep.Configure,
    items: checkpointItems,
    impact: [
      'Column assignments will determine model structure',
      'All subsequent analysis uses these assignments',
      'Changing columns requires re-running workflow'
    ],
    onConfirm: () => {
      closeCheckpoint();
      const decisionId = logDecision({
        step: AppStep.Configure,
        type: 'LOCK',
        summary: 'Locked column assignments',
        details: `Confirmed ${dependentVars.length} KPI, ${spendChannels.length} channels`,
        status: 'ACTIVE'
      });
      lockDecision(decisionId);
      handleProceedWithColumnSelection();
    },
    onEdit: () => {
      closeCheckpoint();
      setAwaitingColumnConfirmation(true);
      addMessage("No problem. Adjust column types and let me know when ready.", 'ai');
    }
  });
}
```

## Critical Rules

### ✅ DO
- Always show checkpoint before proceeding with critical decisions
- Provide clear, actionable items in checkpoint
- Show meaningful downstream impacts
- Log decisions with detailed context
- Lock decisions after user confirmation
- Require detailed reasons (min 10 chars) for overrides
- Log OVERRIDE type for proceed-anyway actions

### ❌ DON'T
- Skip checkpoints for any confirmation flow
- Allow overrides without mandatory reasoning
- Show generic or vague impact statements
- Lock decisions without user explicit confirmation
- Proceed without logging the decision

## Override Justification

When user chooses "Proceed Anyway":
1. Modal shows text area for reason
2. Minimum 10 characters required
3. Clear explanation that reason will be logged
4. "Confirm & Proceed Anyway" button
5. Decision logged as `type: 'OVERRIDE'`
6. Details include user's reason

**Example Override Log:**
```typescript
{
  id: 'decision_xyz',
  step: AppStep.DataValidation,
  type: 'OVERRIDE',
  summary: 'Proceeded with channel selection despite warnings',
  details: 'User reason: TV channel has brand building effects not captured in short-term data. Keeping it based on domain knowledge. Excluded 2 channels with data quality issues.',
  status: 'ACTIVE',
  timestamp: 1703347200000
}
```

## Testing

### Manual Test Checklist

**Column Assignment Checkpoint:**
- [ ] Checkpoint shows after "yes" to column confirmation
- [ ] All column types displayed correctly
- [ ] Warnings show for missing required columns
- [ ] "Lock & Proceed" logs decision and proceeds
- [ ] "Go Back & Edit" returns to Configure step
- [ ] Decision appears in Decision Log panel

**Channel Approval Checkpoint:**
- [ ] Checkpoint shows after "proceed to features"
- [ ] Approved channels listed correctly
- [ ] Excluded channels shown with warning
- [ ] Override option available when channels excluded
- [ ] Override requires 10+ character reason
- [ ] OVERRIDE decision logged with reason

**Feature Engineering Checkpoint:**
- [ ] Checkpoint shows after "proceed to modeling"
- [ ] All channel parameters displayed
- [ ] No warnings for valid parameters
- [ ] Decision locked after confirmation

**Model Finalization Checkpoint:**
- [ ] Checkpoint shows after "yes" to finalize
- [ ] Model details displayed correctly
- [ ] Weak channels shown as warnings
- [ ] Override available for models with warnings
- [ ] Final model locked after confirmation

**General:**
- [ ] Modal backdrop dims background
- [ ] ESC key closes modal (optional)
- [ ] All decisions persist in localStorage
- [ ] Locked decisions show 🔒 in Decision Log
- [ ] Override decisions show details in log

## Files Modified

- `components/DecisionCheckpointModal.tsx` - New modal component
- `App.tsx:44` - Import DecisionCheckpointModal
- `App.tsx:60-79` - Add checkpoint modal state
- `App.tsx:253-272` - Add helper functions
- `App.tsx:1391-1439` - Column confirmation checkpoint
- `App.tsx:1447-1508` - Channel approval checkpoint
- `App.tsx:1527-1565` - Feature engineering checkpoint
- `App.tsx:1582-1651` - Model finalization checkpoint
- `App.tsx:2240-2251` - Render checkpoint modal

## Benefits

1. **Transparency**: Users see exactly what's being locked
2. **Auditability**: Full trail of decisions with timestamps
3. **Safety**: Prevents accidental changes to critical settings
4. **Flexibility**: Override option with justification requirement
5. **Education**: Downstream impact helps users understand consequences
6. **Compliance**: Decision log provides audit trail for stakeholders

## Future Enhancements

- Email notification for locked decisions
- Admin approval for overrides
- Decision comparison view
- Bulk decision review
- Decision reversal workflow
- Export decisions to PDF for documentation
