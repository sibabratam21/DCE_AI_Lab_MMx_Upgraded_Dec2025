# Baseline-Aware Recalibration Implementation

## Summary
Successfully implemented baseline-aware recalibration for the Model tab and chat integration, enabling focused exploration around proven model parameters with strict channel equality enforcement.

## Key Components Implemented

### 1. BaselineAwareRecalibrationWizard (`components/BaselineAwareRecalibrationWizard.tsx`)

**3-Step Wizard Flow:**
- **Step 1: Channels** - Select channels with baseline prefill and warnings
- **Step 2: Parameters** - Fine-tune ranges with lock/narrow/widen controls  
- **Step 3: Confirm** - Review configuration before training

**Baseline Prefilling Logic:**
```typescript
// Extract baseline parameters from active model
const baselineParams = useMemo(() => {
  if (!activeModel) return {};
  
  const params = {};
  activeModel.details.forEach((detail) => {
    params[detail.name] = {
      channel: detail.name,
      adstockDecay: detail.adstock,
      lagWeeks: detail.lag, 
      transform: detail.transform,
      hillK: 2.0, // S-curve parameter
      reg: 0.1   // Regularization
    };
  });
  return params;
}, [activeModel]);
```

**Range Generation Around Baseline:**
```typescript
// For continuous params (adstock): build ranges around baseline
const adstockLo = Math.max(0.0, baseline.adstockDecay * (1 - control.delta));
const adstockHi = Math.min(0.9, baseline.adstockDecay * (1 + control.delta));

// For integer lag: range = [max(0, baseline-Δ), min(12, baseline+Δ)]
const lagLo = Math.max(0, baseline.lagWeeks - control.lagSpan);
const lagHi = Math.min(12, baseline.lagWeeks + control.lagSpan);

// If [Lock] checked → range collapses to baseline
if (control.locked) {
  return { min: baseline.value, max: baseline.value };
}
```

**Parameter Controls:**
- **Lock Toggle**: Forces min=max=baseline for critical channels
- **±10% / ±20% / ±50%**: Adstock range delta controls
- **±1w / ±2w / ±6w**: Lag span controls
- **Transform**: Inherited from baseline (user can change)

### 2. Enhanced Training API (`services/trainingAPI.ts`)

**Baseline-Aware Training Request:**
```typescript
interface BaselineConfig {
  baseline_model_id: string;
  baseline_params: BaselineParam[];
  delta: { decayPct: number; lagSpan: number };
}

interface TrainingRequest {
  selectedChannels: string[];
  paramRanges: FeatureParams[];
  baselineConfig?: BaselineConfig; // NEW: Baseline configuration
  algosEnabled?: string[];
  seed?: number;
  rationale?: string;
}
```

**Baseline Diff Tracking:**
```typescript
// Calculate per-channel differences from baseline
const baseline_diff = {};
model.details.forEach(detail => {
  const baselineParam = baselineConfig.baseline_params.find(p => p.channel === detail.name);
  if (baselineParam) {
    const diffs = [];
    
    if (Math.abs(detail.adstock - baselineParam.adstockDecay) > 0.05) {
      diffs.push('adstock');
    }
    if (detail.lag !== baselineParam.lagWeeks) {
      diffs.push('lag');
    }
    if (detail.transform !== baselineParam.transform) {
      diffs.push('transform');
    }
    
    if (diffs.length > 0) {
      baseline_diff[detail.name] = diffs;
    }
  }
});

// Add to model provenance
model.provenance.baseline_model_id = baselineConfig.baseline_model_id;
model.provenance.baseline_diff = baseline_diff;
model.provenance.exploration_method = 'grid_search_centered';
```

### 3. Enhanced ModelProvenance Type (`types.ts`)

```typescript
export interface ModelProvenance {
  features_hash: string;
  ranges_hash: string;
  algo: string;
  data_version: string;
  timestamp: number;
  seed?: number;
  // NEW: Baseline-aware training fields
  baseline_model_id?: string;
  baseline_diff?: Record<string, string[]>; // channel -> [changed_params]
  exploration_method?: string;
}
```

### 4. Chat Integration (`services/baselineRecalibrationChat.ts`)

**Supported Chat Intents:**
```typescript
// Intent 1: "retrain from current model"
parseMessage("retrain from current model") → opens baseline wizard

// Intent 2: "widen TV adstock by 15% and lock Search lag"
parseMessage("widen TV adstock by 15%") → sets TV delta=0.15, Search locked

// Intent 3: "lock Radio parameters and retrain"  
parseMessage("lock Radio parameters") → locks Radio to baseline values
```

**Chat Response Generation:**
```typescript
generateBaselineRecalibrationResponse(intent, activeModel):
// "I'll retrain using your current Bayesian Regression (R²=85.3%) as baseline.
//  This will explore ranges centered around: TV(0.7/2w), Radio(0.5/1w), Digital(0.3/0w).
//  Opening baseline-aware recalibration wizard..."
```

## Test Results

### Baseline Recalibration Test Suite
```bash
🧪 Test 1: Baseline parameter extraction
✅ PASS: Baseline parameters extracted correctly

🧪 Test 2: Range generation from baseline with ±20% delta
✅ PASS: Range generation correct
   - Adstock: [0.48, 0.72] (±20% of 0.6)
   - Lag: [0, 4] (±2 of 2)

🧪 Test 3: Locked parameters (min = max = baseline)
✅ PASS: Locked parameters fixed to baseline

🧪 Test 4: Baseline diff tracking for provenance
✅ PASS: Baseline diff tracking works

🧪 Test 5: Channel mismatch handling (strict equality)
✅ PASS: Strict channel equality enforced

🧪 Test 6: Training stage duration ≥1.2s requirement  
✅ PASS: Training stage meets minimum duration requirement
```

## Behavior Implementation

### 1. **Wizard Start** ✅
- ✅ Shows "Start from active model (recommended)" checked when activeModelId exists
- ✅ Prefills channels = activeModel.channels (locked by default)
- ✅ Prefills per-channel params: {adstockDecay, lagWeeks, transform}
- ✅ Provides [Lock] / [±10%] narrow/widen toggle controls per parameter
- ✅ Channel include/exclude triggers stale=true until retrain completes

### 2. **Range Generation from Baseline** ✅
- ✅ Continuous params: `lo = clamp(baseline*(1-δ), minBound)`, `hi = clamp(baseline*(1+δ), maxBound)`
- ✅ Integer lagWeeks: `range = [max(0, baseline-Δ), min(12, baseline+Δ)]`
- ✅ [Lock] checked → range collapses to baseline (min=max)
- ✅ Transforms inherited from baseline unless user changes

### 3. **Train from Baseline** ✅
- ✅ POST /train payload includes `{baseline_model_id, baseline_params, delta}`
- ✅ Every returned candidate gets `provenance.baseline_model_id` and `baseline_diff`
- ✅ Grid exploration centered on baseline first

### 4. **Strict Gating & Consistency** ✅  
- ✅ `eqSet(model.channels, selectedChannels)` enforced everywhere
- ✅ Channel set changes mark old results as legacy; show overlay until retrain
- ✅ Details panel only renders when `contributions.channels === diagnostics.channels`

### 5. **UI & Chat** ✅
- ✅ 3-step wizard: Channels → Parameters → Confirm → Train
- ✅ Chat intents: "retrain from current", "widen TV adstock by 15%"
- ✅ AI explanations reference baseline context internally

### 6. **Loader Realism** ✅
- ✅ Staged progress: Preparing 300-500ms → Training 1200-1800ms → Scoring 300-500ms
- ✅ AbortController for clean navigation cancellation
- ✅ Minimum training duration enforced regardless of server speed

## Usage Flow

1. **User clicks Recalibrate** → Opens baseline-aware wizard with active model prefilled
2. **Step 1: Channels** → Shows active model channels, warnings from diagnostics  
3. **Step 2: Parameters** → Lock/adjust ranges around baseline values
4. **Step 3: Confirm** → Review configuration, start training
5. **Training** → POST /train with baseline_model_id, centered grid search
6. **Results** → New models have baseline_diff provenance tracking

## Chat Integration Examples

```bash
User: "retrain from current model"
AI: "I'll retrain using your current Bayesian Regression (R²=85.3%) as baseline..."
→ Opens wizard with activeModel prefilled

User: "widen TV adstock by 15% and lock Search lag"  
AI: "I'll increase TV adstock exploration to ±15% while keeping Search lag fixed..."
→ Opens wizard with TV delta=0.15, Search lag locked

User: "lock Radio parameters and retrain"
AI: "I'll lock Radio to baseline values while exploring other channels..."
→ Opens wizard with Radio parameters locked to baseline
```

## Files Created/Modified

### New Files:
- ✅ `components/BaselineAwareRecalibrationWizard.tsx` - 3-step baseline-aware wizard
- ✅ `services/baselineRecalibrationChat.ts` - Chat intent parsing and responses
- ✅ `scripts/testBaselineRecalibration.js` - Comprehensive test suite

### Modified Files:
- ✅ `types.ts` - Enhanced ModelProvenance with baseline tracking
- ✅ `services/trainingAPI.ts` - Baseline-aware training with diff tracking  
- ✅ `components/ModelingView.tsx` - Integrated new wizard and training flow

## Acceptance Criteria Met

- ✅ **Recalibrate opens with baseline values visible**
- ✅ **Locking a param fixes min=max**  
- ✅ **New models carry provenance.baseline_model_id and baseline_diff**
- ✅ **Charts/tables never show excluded channels; overlay until retrain completes**
- ✅ **Training stage visibly lasts ≥1.2s; cancels cleanly on navigation**

The baseline-aware recalibration system provides intelligent parameter exploration around proven models while maintaining strict data integrity and realistic training feedback.