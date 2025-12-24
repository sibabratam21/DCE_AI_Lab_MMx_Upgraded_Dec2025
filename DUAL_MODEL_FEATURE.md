# Dual Model Lens Feature

## Overview
The Dual Model Lens feature transforms the single-model UI into a comprehensive dual-perspective modeling system that explicitly shows CUSTOMER-level vs GEO-level model results with consistency analysis. This addresses the common MMM challenge where different aggregation levels (customer vs geographic) can produce different insights.

## Key Features

### 🔄 Dual Model Perspectives
- **CUSTOMER Model**: Individual behavior and direct response effects
- **GEO Model**: Market-level effects and broad reach channels (TV, brand)
- **Consistency Analysis**: Compare both perspectives to validate assumptions

### 📊 Consistency Scoring
- **Overall Agreement Score**: 0-100% showing how aligned the two models are
- **Channel-Level Agreement**: Individual scores for each marketing channel
- **Conflicting Channels**: Identifies channels with <70% agreement
- **Recommended Model**: Data-driven recommendation (CUSTOMER, GEO, or DUAL)

### 🎯 Demo-Safe Implementation
- Synthetic GEO models generated with controlled variation
- No changes to optimization logic
- Existing ModelingView and FinalReport remain intact
- Pure presentation layer enhancement

## Architecture

### New Components

#### 1. **DualModelView.tsx**
Wrapper for ModelingView with three tabs:
- **CUSTOMER Model Tab**: Shows customer-level leaderboard and details
- **GEO Model Tab**: Shows geo-level leaderboard and details
- **Consistency Tab**: Model comparison and conflict analysis

**Props**: Same as ModelingView (pass-through wrapper)

**State**:
```typescript
const [activeTab, setActiveTab] = useState<'customer' | 'geo' | 'consistency'>('customer');
```

**Key Functions**:
- `generateDualModelLeaderboards()`: Creates synthetic GEO models from CUSTOMER models
- `generateModelConsistency()`: Computes agreement scores and identifies conflicts

---

#### 2. **DualModelReport.tsx**
Wrapper for RevertedFinalReport with three tabs (mirrors DualModelView structure):
- **CUSTOMER Report Tab**: Attribution and channel performance
- **GEO Report Tab**: Market-level attribution
- **Model Comparison Tab**: Consistency panel

**Props**: Same as RevertedFinalReport (pass-through wrapper)

---

#### 3. **ModelConsistencyPanel.tsx**
Detailed consistency analysis view

**Sections**:
1. **Header**: Overall agreement score with color-coding
2. **Model Performance Comparison**: R², MAPE, algorithm side-by-side
3. **Recommendation**: Data-driven advice on which model(s) to use
4. **Channel-Level Agreement**: Sorted list showing least consistent channels first
5. **Conflicting Channels**: Detailed breakdown of channels <70% agreement
6. **Resolution Options**: Actionable steps to resolve conflicts

**Props**:
```typescript
interface ModelConsistencyPanelProps {
  consistency: ModelConsistency;
  customerModel: ModelRun | null;
  geoModel: ModelRun | null;
}
```

---

### New Services

#### **services/consistencyUtils.ts**

**Core Functions**:

1. **`generateModelConsistency()`**
   - Compares CUSTOMER vs GEO models
   - Calculates agreement scores per channel and overall
   - Identifies conflicting channels (<70% agreement)
   - Determines recommended owner model
   - Provides reasoning for recommendation

2. **`generateSyntheticGeoModel()`**
   - Creates realistic GEO model variation from CUSTOMER model
   - Introduces 10-30% controlled ROI variance
   - ~33% of channels will conflict (varied by 50-150%)
   - ~67% of channels will be consistent (varied by 85-115%)

3. **`generateDualModelLeaderboards()`**
   - Duplicates entire leaderboard for both lenses
   - Applies synthetic variation to create GEO models

---

### Updated Types (types.ts)

```typescript
export interface ModelConsistency {
  overallAgreementScore: number; // 0-100
  conflictingChannels: {
    channel: string;
    customerROI: number;
    geoROI: number;
    difference: number;
    direction: 'CUSTOMER_HIGHER' | 'GEO_HIGHER';
  }[];
  recommendedOwnerModel: 'CUSTOMER' | 'GEO' | 'DUAL';
  reasoning: string;
  channelAgreement: {
    channel: string;
    agreementScore: number; // 0-100
    consistent: boolean; // true if >= 70%
  }[];
}

export type ModelLens = 'CUSTOMER' | 'GEO';
```

---

## Agreement Score Calculation

### Per-Channel Agreement
```typescript
const avgROI = (customerROI + geoROI) / 2;
const difference = Math.abs(customerROI - geoROI);
const relativeDifference = avgROI > 0 ? (difference / avgROI) * 100 : 100;
const agreementScore = Math.max(0, 100 - relativeDifference);
```

**Examples**:
- Customer ROI: 2.0x, GEO ROI: 2.0x → Agreement: 100%
- Customer ROI: 2.0x, GEO ROI: 1.8x → Agreement: 90%
- Customer ROI: 2.0x, GEO ROI: 1.0x → Agreement: 33%

### Overall Agreement
Weighted average of all channel agreement scores:
```typescript
overallAgreementScore = sum(channelAgreementScores) / channelCount
```

### Consistent Threshold
Channels with agreement >= 70% are considered "consistent"

---

## Recommendation Logic

### DUAL Model (Run Both)
**Triggers**:
- Overall agreement >= 80%
- All channels consistent
- Multiple conflicts but similar model performance (R² within 10%)

**Reasoning**: "High agreement suggests both perspectives are valid. Run both for comprehensive insights."

### CUSTOMER Primary
**Triggers**:
- Many conflicts (>50% of channels)
- CUSTOMER model R² > 10% better than GEO

**Reasoning**: "Significant conflicts detected. CUSTOMER model shows superior fit (R²: X% vs Y%). Recommend CUSTOMER-level modeling as primary."

### GEO Primary
**Triggers**:
- Many conflicts (>50% of channels)
- GEO model R² > 10% better than CUSTOMER

**Reasoning**: "Significant conflicts detected. GEO model shows superior fit (R²: X% vs Y%). Recommend GEO-level modeling as primary."

---

## User Workflow

### Modeling Step
1. User trains models (existing flow)
2. Opens **Modeling View** → sees 3 tabs
3. **CUSTOMER Tab**: Reviews customer-level leaderboard
4. **GEO Tab**: Reviews geo-level leaderboard
5. **Consistency Tab**:
   - Views overall agreement score
   - Identifies conflicting channels
   - Reads recommendation
6. Decides whether to finalize CUSTOMER, GEO, or both models

### Report Step
1. User finalizes model (existing flow)
2. Opens **Report** → sees 3 tabs
3. **CUSTOMER Report**: Attribution breakdown
4. **GEO Report**: Market-level attribution
5. **Model Comparison**: Validates consistency before optimization

---

## Visual Design

### Tab Navigation
- Top-aligned horizontal tabs
- Icons: 👤 (CUSTOMER), 🌍 (GEO), 🔍 (Consistency)
- Active tab: Indigo underline and text
- Consistency tab shows agreement badge (green/yellow/red)

### Agreement Score Colors
- **Green** (>=80%): High agreement, safe to proceed
- **Yellow** (60-79%): Moderate agreement, review conflicts
- **Red** (<60%): Low agreement, investigate thoroughly

### Conflicting Channels Card
- Red background with prominent warning
- Shows ROI comparison (CUSTOMER vs GEO)
- Highlights difference magnitude
- Provides resolution options

---

## Integration in App.tsx

### Imports (lines 31-32)
```typescript
import { DualModelView } from './components/DualModelView';
import { DualModelReport } from './components/DualModelReport';
```

### Modeling Step (line 2260)
```typescript
return <DualModelView
  models={modelLeaderboard}
  selectedChannels={approvedChannels}
  activeModelId={activeModelId}
  // ... other props
/>
```

### Report Step (line 2363)
```typescript
return <DualModelReport
  activeModelId={finalizedModel?.id || null}
  models={modelLeaderboard}
  selectedChannels={approvedChannels}
  // ... other props
/>
```

---

## Synthetic Model Generation

### Variation Strategy
For demo purposes, GEO models are generated with:
- **Base Performance**: ±10% variation in R² and MAPE
- **Channel ROI**:
  - 33% channels: 50-150% of CUSTOMER ROI (creates conflicts)
  - 67% channels: 85-115% of CUSTOMER ROI (remains consistent)
- **Deterministic Seed**: Uses channel index to ensure repeatable results

### Example Synthetic GEO Model
```typescript
// CUSTOMER Model
channel: 'Google_Ads', roi: 2.5x

// GEO Model (consistent variation)
channel: 'Google_Ads', roi: 2.6x  // 104% of customer
agreementScore: 96%  // Consistent

// GEO Model (conflict variation)
channel: 'TV_Spend', roi: 4.2x  // 168% of customer (2.5x original)
agreementScore: 52%  // Conflicting
```

---

## Files Created

1. **components/DualModelView.tsx** (186 lines)
   - Tab navigation wrapper
   - Dual leaderboard generation
   - Consistency computation

2. **components/DualModelReport.tsx** (151 lines)
   - Report tab navigation
   - Same structure as DualModelView

3. **components/ModelConsistencyPanel.tsx** (296 lines)
   - Consistency UI with all sections
   - Color-coded agreement scores
   - Conflict resolution guidance

4. **services/consistencyUtils.ts** (169 lines)
   - Agreement score calculation
   - Synthetic model generation
   - Recommendation logic

5. **DUAL_MODEL_FEATURE.md** (this file)
   - Complete documentation

---

## Files Modified

1. **types.ts** (lines 274-292)
   - Added `ModelConsistency` interface
   - Added `ModelLens` type

2. **App.tsx** (lines 31-32, 2260, 2363)
   - Import dual model components
   - Replace ModelingView with DualModelView
   - Replace RevertedFinalReport with DualModelReport

---

## Testing Scenarios

### Scenario 1: High Agreement (>80%)
**Expected**:
- Green badge on Consistency tab
- "Run both models" recommendation
- Most/all channels shown as consistent
- Empty or minimal conflicting channels section

### Scenario 2: Moderate Agreement (60-80%)
**Expected**:
- Yellow badge on Consistency tab
- "Dual modeling recommended with careful interpretation" reasoning
- Mix of consistent and conflicting channels
- Specific conflict breakdown with resolution options

### Scenario 3: Low Agreement (<60%)
**Expected**:
- Red badge on Consistency tab
- Recommendation for CUSTOMER or GEO primary (based on R²)
- Many conflicting channels
- Detailed conflict analysis with actionable steps

### Scenario 4: Model Selection Across Tabs
**Action**: Select model in CUSTOMER tab
**Expected**:
- GEO tab shows corresponding GEO model
- Consistency tab updates with new comparison
- Agreement scores recalculate

---

## Benefits

1. **Transparency**: Users see both perspectives explicitly
2. **Validation**: Consistency analysis catches modeling issues
3. **Education**: Teaches users about aggregation level impact
4. **Flexibility**: Supports CUSTOMER-only, GEO-only, or dual modeling
5. **Demo-Safe**: Synthetic generation means no real dual modeling required
6. **Non-Breaking**: Wraps existing components without modification

---

## Future Enhancements

1. **Real Dual Modeling**: Replace synthetic with actual parallel model runs
2. **Channel Ownership UI**: Interactive reassignment based on conflicts
3. **Optimization Integration**: Separate optimization runs per model lens
4. **Historical Comparison**: Track agreement scores over time
5. **Export Consistency Report**: PDF/CSV export of conflict analysis
6. **Sensitivity Analysis**: Test agreement under different parameter ranges

---

## Critical Rules

### ✅ DO
- Always show both CUSTOMER and GEO tabs
- Calculate consistency for every model selection
- Highlight conflicting channels prominently
- Provide actionable recommendations
- Use color-coding for quick visual scanning
- Sort channel agreement by lowest first (most important conflicts on top)

### ❌ DON'T
- Hide the Consistency tab even if agreement is 100%
- Recommend a single model without clear reasoning
- Show generic advice for conflict resolution
- Use red/yellow colors without clear thresholds
- Modify optimization logic (not in scope)

---

## Known Limitations

1. **Synthetic Models**: GEO models are fabricated, not real
2. **No Optimization Split**: Optimization still uses single model
3. **Fixed Variation Rate**: 33% conflict rate is hardcoded
4. **No Cross-Model Calibration**: Can't adjust one model based on the other
5. **Memory Overhead**: Duplicate leaderboards increase state size

---

## Success Metrics

- User understands difference between CUSTOMER and GEO perspectives
- Conflicting channels are identified before optimization
- Recommendation guides model selection
- No user confusion from dual tabs (clear labeling)
- Consistency score provides actionable insight
