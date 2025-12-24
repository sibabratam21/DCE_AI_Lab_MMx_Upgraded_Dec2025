# Agent Critic System

## Overview
The Agent Critic System is a rule-based validation layer that raises warnings when user choices conflict with MMM (Marketing Mix Modeling) best practices. Unlike the Agent Planner which suggests next actions, the Agent Critic actively intervenes to prevent suboptimal decisions.

## Key Features

### 🚨 Warning System
- **Severity Levels**: WARNING (can override) or ERROR (must fix)
- **Best Practice Rules**: Four critical rules covering common MMM pitfalls
- **Mandatory Acknowledgment**: Users must acknowledge or override warnings
- **Override Justification**: Overrides require detailed reasoning (min 10 characters)
- **Full Audit Trail**: All warnings and overrides logged to DecisionLog

### 🔍 Rule-Based Logic (NO LLM)
- Pure TypeScript validation logic
- Deterministic and fast
- No API calls or latency
- Predictable behavior

## Implemented Rules

### 1. **TV Assigned to Customer Level**
**Rule ID**: `TV_AT_CUSTOMER_LEVEL`
**Severity**: WARNING (can override)
**Trigger**: When TV/CTV channels are assigned to CUSTOMER-level ownership

**Rationale**:
TV advertising has broad reach and brand-building effects that operate at a geographic or market level, not individual customer level. Customer-level models may fail to capture TV's true impact, leading to underestimation of ROI.

**Recommendation**:
Reassign TV/CTV channels to GEO-level ownership, or run a dual model setup (both CUSTOMER and GEO) to properly capture TV effects at the market level.

**Context Captured**:
```typescript
{
  tvChannels: ['TV_Spend', 'CTV_Impressions'],
  ownership: 'CUSTOMER'
}
```

---

### 2. **Monthly Data + Weekly Lag**
**Rule ID**: `MONTHLY_DATA_WEEKLY_LAG`
**Severity**: WARNING (can override)
**Trigger**: When data grain is MONTH but lag parameters are 1-4 weeks

**Rationale**:
With monthly data, lag parameters should be specified in months, not weeks. Weekly lags don't make sense for monthly data and will cause model misspecification.

**Recommendation**:
Adjust lag parameters to monthly units. For example, if you expect a 2-week lag, use lag=1 month. For 6-week lag, use lag=2 months.

**Context Captured**:
```typescript
{
  grain: 'MONTH',
  channelsWithWeeklyLag: ['Google_Ads', 'Facebook'],
  lagValues: [
    { channel: 'Google_Ads', lag: { min: 0, max: 2 } },
    { channel: 'Facebook', lag: { min: 1, max: 3 } }
  ]
}
```

---

### 3. **Sparse Activity + High Adstock**
**Rule ID**: `SPARSE_ACTIVITY_HIGH_ADSTOCK`
**Severity**: WARNING (can override)
**Trigger**: When channel has >60% zero values AND adstock max > 8 periods

**Rationale**:
High adstock creates carryover effects across many time periods, but with sparse data (>60% zeros), there's insufficient information to reliably estimate these long decay patterns. This can lead to unstable coefficients and inflated ROI estimates.

**Recommendation**:
For sparse channels, reduce adstock to 2-4 periods max, or consider excluding the channel if activity is too infrequent for reliable modeling.

**Context Captured**:
```typescript
{
  sparseChannels: [
    { channel: 'Radio_Spend', adstockMax: 12 },
    { channel: 'Print_Ads', adstockMax: 10 }
  ]
}
```

**Sparsity Calculation**:
```typescript
const sparsityPercent = (zeroCount / totalRows) * 100;
const isSparse = sparsityPercent > 60;
```

---

### 4. **Spend Missing + ROI Request**
**Rule ID**: `SPEND_MISSING_ROI_REQUEST`
**Severity**: ERROR (cannot override if NONE, can override if PARTIAL)
**Trigger**: When at Modeling/Report step and spendAvailability is 'NONE' or 'PARTIAL'

**Rationale**:
ROI and ROAS metrics require both revenue impact (from the model) AND spend data to calculate return on investment. Without complete spend data, you can only measure marketing effectiveness via coefficients and elasticity, not financial ROI.

**Recommendation (NONE)**:
Add spend columns to your dataset, or switch to an activity-based model that focuses on effectiveness rather than ROI.

**Recommendation (PARTIAL)**:
Complete missing spend data for all marketing channels, or exclude channels without spend from ROI calculations.

**Context Captured**:
```typescript
{
  spendAvailability: 'NONE' | 'PARTIAL'
}
```

## Component Architecture

### services/agentCritic.ts

**Main Function**:
```typescript
export function criticizeDecision(context: CriticContext): CriticWarning[]
```

**Context Interface**:
```typescript
export interface CriticContext {
  analysisState: AnalysisState;
  currentStep: AppStep;
  userSelections?: UserColumnSelection;
  featureParams?: FeatureParams[];
  parsedData?: ParsedData;
}
```

**Warning Interface** (types.ts):
```typescript
export interface CriticWarning {
  id: string;
  rule: string;
  severity: 'WARNING' | 'ERROR';
  title: string;
  explanation: string;
  recommendation: string;
  canOverride: boolean;
  step: AppStep;
  context: Record<string, any>;
}
```

**Rule Functions**:
- `checkTvAtCustomerLevel()`
- `checkMonthlyDataWeeklyLag()`
- `checkSparseActivityHighAdstock()`
- `checkSpendMissingRoiRequest()`

### components/CriticWarningModal.tsx

**Props**:
```typescript
interface CriticWarningModalProps {
  isOpen: boolean;
  warnings: CriticWarning[];
  onAcknowledge: () => void;
  onOverride: (reason: string) => void;
  onGoBack: () => void;
}
```

**Visual Design**:
- **Header**: Red (ERROR) or Yellow (WARNING) gradient background
- **Warning Cards**: Bordered cards with severity badges
- **Explanation Section**: "Why This Matters"
- **Recommendation Section**: "💡 Recommendation" with actionable advice
- **Override Input**: Text area with character counter (min 10 chars)
- **Footer Actions**:
  - "← Go Back & Fix" (always available)
  - "✓ Acknowledge & Proceed" (only if no ERRORs)
  - "Override Anyway" → "Confirm Override" (only if canOverride)

**States**:
- Default: Shows all warnings with actions
- Override Mode: Shows text area for justification
- Cannot Override: Shows 🔒 lock icon for ERRORs that must be fixed

## Integration in App.tsx

### State Variables (lines 86-91)
```typescript
const [criticWarnings, setCriticWarnings] = useState<CriticWarning[]>([]);
const [isCriticModalOpen, setIsCriticModalOpen] = useState<boolean>(false);
const [criticOnAcknowledge, setCriticOnAcknowledge] = useState<(() => void) | null>(null);
const [criticOnOverride, setCriticOnOverride] = useState<((reason: string) => void) | null>(null);
const [criticOnGoBack, setCriticOnGoBack] = useState<(() => void) | null>(null);
```

### Helper Functions (lines 286-365)

**Show Critic Warnings**:
```typescript
const showCriticWarnings = useCallback((
  warnings: CriticWarning[],
  onAcknowledge: () => void,
  onOverride: (reason: string) => void,
  onGoBack: () => void
) => {
  setCriticWarnings(warnings);
  setCriticOnAcknowledge(() => onAcknowledge);
  setCriticOnOverride(() => onOverride);
  setCriticOnGoBack(() => onGoBack);
  setIsCriticModalOpen(true);
}, []);
```

**Run Critic Check** (Main Integration Point):
```typescript
const runCriticCheck = useCallback(
  (onProceed: () => void, onCancel: () => void) => {
    const warnings = criticizeDecision({
      analysisState,
      currentStep,
      userSelections,
      featureParams,
      parsedData
    });

    if (warnings.length > 0) {
      showCriticWarnings(
        warnings,
        // On Acknowledge
        () => {
          closeCriticModal();
          warnings.forEach(w => {
            logDecision({
              step: currentStep,
              type: 'WARNING',
              summary: `Acknowledged critic warning: ${w.title}`,
              details: w.explanation,
              status: 'ACTIVE'
            });
          });
          onProceed();
        },
        // On Override
        (reason: string) => {
          closeCriticModal();
          warnings.forEach(w => {
            logDecision({
              step: currentStep,
              type: 'OVERRIDE',
              summary: `Overrode critic warning: ${w.title}`,
              details: `User reason: ${reason}. Warning: ${w.explanation}`,
              status: 'ACTIVE'
            });
          });
          onProceed();
        },
        // On Go Back
        () => {
          closeCriticModal();
          onCancel();
        }
      );
    } else {
      onProceed();
    }
  },
  [analysisState, currentStep, userSelections, featureParams, parsedData, showCriticWarnings, closeCriticModal, logDecision]
);
```

### Integration Points

**1. Column Assignment Checkpoint** (line 1538-1557):
```typescript
onConfirm: () => {
  closeCheckpoint();

  // Run critic check before proceeding
  runCriticCheck(
    // On Proceed
    () => {
      const decisionId = logDecision({...});
      lockDecision(decisionId);
      handleProceedWithColumnSelection();
    },
    // On Cancel
    () => {
      setAwaitingColumnConfirmation(true);
      addMessage("Please review and adjust your column assignments based on the warnings.", 'ai');
    }
  );
}
```

**2. Feature Engineering Checkpoint** (line 1676-1695):
```typescript
onConfirm: () => {
  closeCheckpoint();

  // Run critic check before proceeding to modeling
  runCriticCheck(
    // On Proceed
    () => {
      const decisionId = logDecision({...});
      lockDecision(decisionId);
      handleRunModels();
    },
    // On Cancel
    () => {
      setAwaitingFeatureConfirmation(true);
      addMessage("Please review and adjust the feature parameters based on the warnings.", 'ai');
    }
  );
}
```

**3. Render** (line 2547-2554):
```tsx
<CriticWarningModal
  isOpen={isCriticModalOpen}
  warnings={criticWarnings}
  onAcknowledge={() => criticOnAcknowledge && criticOnAcknowledge()}
  onOverride={(reason) => criticOnOverride && criticOnOverride(reason)}
  onGoBack={() => criticOnGoBack && criticOnGoBack()}
/>
```

## Workflow Flow

```
User Makes Decision
       ↓
Decision Checkpoint Modal
       ↓
User Confirms
       ↓
runCriticCheck()
       ↓
criticizeDecision() [runs all 4 rules]
       ↓
Warnings Found? ──NO──→ Proceed Immediately
       ↓ YES
Show CriticWarningModal
       ↓
User Chooses:
  - Go Back → onCancel() → Return to editing
  - Acknowledge → Log WARNING → onProceed()
  - Override → Require reason (10+ chars) → Log OVERRIDE → onProceed()
```

## Decision Log Entries

### Acknowledged Warning
```typescript
{
  id: 'decision_xyz',
  step: AppStep.Configure,
  type: 'WARNING',
  summary: 'Acknowledged critic warning: TV Channel Assigned to Customer Level',
  details: 'TV/CTV channels (TV_Spend) are assigned to CUSTOMER-level modeling. TV advertising typically has broad reach and brand-building effects that operate at a geographic or market level...',
  status: 'ACTIVE',
  timestamp: 1703347200000
}
```

### Override with Justification
```typescript
{
  id: 'decision_xyz',
  step: AppStep.FeatureEngineering,
  type: 'OVERRIDE',
  summary: 'Overrode critic warning: Monthly Data with Weekly Lag',
  details: 'User reason: Our business operates on a 4-week cycle that aligns better with weekly parameters despite monthly reporting. Warning: Your data is aggregated MONTHLY, but 3 channel(s) have lag parameters...',
  status: 'ACTIVE',
  timestamp: 1703347200000
}
```

## Testing Scenarios

### Test 1: TV at Customer Level
1. Upload dataset with TV/CTV columns
2. Assign column types (Configure step)
3. Set TV channel ownership to 'CUSTOMER'
4. Confirm column assignments
5. **Expected**: Critic warning appears with TV assignment issue
6. **Actions**:
   - Go Back → Returns to Configure
   - Acknowledge → Logs warning and proceeds
   - Override → Requires reason, logs OVERRIDE and proceeds

### Test 2: Monthly Data + Weekly Lag
1. Set data grain to 'MONTH'
2. Proceed to Feature Engineering
3. Set lag parameters to 1-4 weeks (e.g., lag.max = 3)
4. Confirm feature parameters
5. **Expected**: Critic warning about weekly lag on monthly data
6. **Actions**: Same as Test 1

### Test 3: Sparse Activity + High Adstock
1. Upload dataset with sparse channels (>60% zeros)
2. Proceed to Feature Engineering
3. Set adstock.max > 8 for sparse channel
4. Confirm feature parameters
5. **Expected**: Critic warning about sparse channel with high adstock
6. **Actions**: Same as Test 1

### Test 4: Spend Missing + ROI Request
1. Upload dataset with NO spend columns (only activity)
2. Proceed to Modeling/Report step
3. **Expected**: Critic ERROR (severity = ERROR, canOverride = false)
4. **Actions**:
   - Go Back → Only option (cannot acknowledge or override)

### Test 5: Partial Spend
1. Upload dataset with PARTIAL spend (some channels missing)
2. Proceed to Modeling/Report step
3. **Expected**: Critic WARNING (severity = ERROR, canOverride = true)
4. **Actions**: Can override with justification

## Benefits

1. **Proactive Quality Control**: Catches common mistakes before they impact model quality
2. **Educational**: Explanations teach users about MMM best practices
3. **Auditability**: Full trail of warnings and overrides with reasoning
4. **Flexibility**: Override option allows domain experts to proceed with justification
5. **No False Positives**: Deterministic rules only fire when truly applicable
6. **Fast**: No LLM calls, instant validation

## Critical Rules

### ✅ DO
- Run critic checks at ALL critical decision points (column config, feature engineering)
- Require detailed override reasons (enforce 10+ character minimum)
- Log both acknowledgments AND overrides to DecisionLog
- Provide clear, actionable recommendations
- Use severity appropriately (WARNING = can override, ERROR = must fix)

### ❌ DON'T
- Skip critic checks to "speed up" workflow
- Allow empty or generic override reasons
- Show critic warnings without clear recommendations
- Use ERROR severity for issues that can reasonably be overridden
- Implement rules that fire too frequently (causes warning fatigue)

## Future Enhancements

- **More Rules**: Add rules for other MMM pitfalls (e.g., multicollinearity, insufficient data periods)
- **Severity Escalation**: Track repeated overrides and escalate warnings
- **Custom Rules**: Allow users to define their own domain-specific rules
- **Rule Configuration**: Enable/disable specific rules via settings
- **Batch Warnings**: Group related warnings into categories
- **Warning Analytics**: Dashboard showing most common warnings and override patterns

## Files Modified

- `types.ts:262-272` - Added CriticWarning interface
- `services/agentCritic.ts` - New file (240 lines) - Rule-based critic logic
- `components/CriticWarningModal.tsx` - New file (237 lines) - Warning modal UI
- `App.tsx:47-49` - Import critic components
- `App.tsx:86-91` - Critic modal state
- `App.tsx:286-365` - Critic helper functions
- `App.tsx:1538-1557` - Column config critic integration
- `App.tsx:1676-1695` - Feature engineering critic integration
- `App.tsx:2547-2554` - Render critic modal
