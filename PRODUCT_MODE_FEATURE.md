# Product Mode Feature

## Overview
The Product Mode feature adds a safety toggle that disables all Gemini API calls and uses only deterministic, rule-based agent logic. This ensures predictable behavior, eliminates external dependencies, and provides a production-safe mode that doesn't require API keys or incur costs.

## Key Features

### 🔒 Product Mode (Default)
- **NO API calls** to Gemini or any external services
- **Deterministic responses** - same input always produces same output
- **Rule-based logic** - confirmation intent detection, summaries, and guidance
- **Zero latency** - instant responses with no network delays
- **No API costs** - completely free to run
- **Offline capable** - works without internet connection

### 🤖 Analyst Mode
- **AI-powered insights** using Gemini API
- **Dynamic responses** tailored to user context
- **Natural language understanding** for complex queries
- **Enhanced summarization** and recommendations
- **Requires API key** and internet connection

## UI Components

### ProductModeToggle Component

**Location**: Top of left sidebar, below Logo

**Visual Design**:
- Toggle buttons: "🔒 Product" | "🤖 Analyst"
- Active mode highlighted with colored background
- Mode description text
- Status indicator:
  - Product: "🟢 Safe Mode" (green)
  - Analyst: "🔵 AI Active" (indigo, pulsing)

**States**:
```typescript
productMode: boolean  // true = Product, false = Analyst
```

**Props**:
```typescript
interface ProductModeToggleProps {
  productMode: boolean;
  onToggle: (enabled: boolean) => void;
}
```

## Deterministic Response Service

### services/deterministicResponses.ts

**Core Functions**:

#### 1. **getDeterministicResponse()**
Returns pre-written responses for each workflow step and context.

```typescript
function getDeterministicResponse(
  step: AppStep,
  context: 'greeting' | 'complete' | 'request' | 'acknowledged' | 'error' | 'custom',
  customKey?: string
): string
```

**Examples**:
```typescript
// Welcome greeting
getDeterministicResponse(AppStep.Welcome, 'greeting')
// → "Welcome to the Marketing Mix Modeling platform..."

// Column analysis complete
getDeterministicResponse(AppStep.Configure, 'complete')
// → "I've analyzed your dataset and identified potential column types..."

// Feature parameters ready
getDeterministicResponse(AppStep.FeatureEngineering, 'complete')
// → "I've generated feature engineering recommendations..."
```

#### 2. **getDeterministicConfirmationIntent()**
Rule-based yes/no intent detection without LLM.

```typescript
function getDeterministicConfirmationIntent(
  query: string
): 'affirmative' | 'negative' | 'unknown'
```

**Pattern Matching**:
- **Affirmative**: yes, yep, yeah, correct, right, confirm, proceed, continue, looks good, ok, sure
- **Negative**: no, nope, incorrect, wrong, change, adjust, modify, edit, fix
- **Unknown**: Any other input

**Examples**:
```typescript
getDeterministicConfirmationIntent("yes") // → 'affirmative'
getDeterministicConfirmationIntent("proceed to modeling") // → 'affirmative'
getDeterministicConfirmationIntent("no thanks") // → 'negative'
getDeterministicConfirmationIntent("what about...") // → 'unknown'
```

#### 3. **getDeterministicFeatureSummary()**
Generates summary text for feature confirmation.

```typescript
function getDeterministicFeatureSummary(channelCount: number): string
```

**Example Output**:
```
I've configured 5 channels with recommended adstock, lag, and transformation parameters.
Each channel's parameters are based on:

• Channel type and behavior patterns
• Industry best practices for MMM
• Data characteristics from your dataset

Review the parameters and adjust if you have specific domain knowledge about delayed effects or carryover.
```

#### 4. **getDeterministicColumnSummary()**
Generates summary of identified columns.

```typescript
function getDeterministicColumnSummary(
  dependentVars: number,
  marketingChannels: number,
  timeColumns: number,
  controls: number
): string
```

**Example Output**:
```
I've analyzed your columns and identified:

• 1 Dependent Variable (KPI to model)
• 5 Marketing Channels (spend or activity)
• 1 Time Dimension
• 2 Control Variables

Please verify these assignments match your expectations.
```

## Integration in App.tsx

### State Variable (line 57)
```typescript
const [productMode, setProductMode] = useState<boolean>(true); // Default to Product mode
```

### Confirmation Intent Checks
All `getConfirmationIntent()` calls are wrapped with mode check:

**Before**:
```typescript
const confirmation = await getConfirmationIntent(query);
```

**After**:
```typescript
const confirmation = productMode
  ? getDeterministicConfirmationIntent(query)
  : await getConfirmationIntent(query);
```

**Updated Locations**:
1. Line 1515-1517: Column confirmation
2. Line 1585-1587: EDA/channel approval confirmation
3. Line 1667-1669: Feature engineering confirmation
4. Line 1736-1738: Model finalization confirmation

### Rule-Based Planner & Critic

**Already Deterministic** - No changes needed:
- `planNext()` in agentPlanner.ts
- `criticizeDecision()` in agentCritic.ts

Both services are pure rule-based logic with NO LLM calls, so they work identically in both modes.

## Workflow Behavior

### Product Mode Flow

#### Step 1: Welcome
**User uploads CSV**
- ✅ Deterministic: File parsing (always the same)
- 🔒 No API call needed

#### Step 2: Configure
**User assigns column types**
- ✅ Deterministic: Column type detection
- ✅ Deterministic: Confirmation intent ("yes" → affirmative)
- 🔒 No API call needed

#### Step 3: Data Validation
**User reviews EDA insights**
- ✅ Deterministic: Statistical analysis (correlation, quality checks)
- ✅ Deterministic: Channel diagnostics
- 🔒 No API call needed (uses hybridAnalysisService with synthetic insights)

#### Step 4: Feature Engineering
**User confirms parameters**
- ✅ Deterministic: Feature recommendation (based on channel type)
- ✅ Deterministic: Summary generation
- ✅ Deterministic: Confirmation intent
- 🔒 No API call needed

#### Step 5: Modeling
**User trains models**
- ✅ Deterministic: Model generation (synthetic or regression)
- ✅ Deterministic: Leaderboard ranking
- ✅ Deterministic: Confirmation intent for finalization
- 🔒 No API call needed

#### Step 6: Report & Optimize
- ✅ Deterministic: Report generation
- ✅ Deterministic: Optimization scenarios
- 🔒 No API call needed

### Analyst Mode Flow

Same workflow, but uses Gemini API for:
- Column analysis insights
- Confirmation intent detection (natural language)
- Feature parameter summaries
- Chat-based interactions

## Benefits

### Product Mode Benefits
1. **Zero Dependencies**: No API key required
2. **Predictable**: Same input → same output
3. **Fast**: No network latency
4. **Cost-Free**: No API usage costs
5. **Offline**: Works without internet
6. **Safe**: No external data transmission
7. **Debuggable**: Deterministic logic is easier to trace

### Analyst Mode Benefits
1. **Intelligent**: Natural language understanding
2. **Adaptive**: Responses tailored to context
3. **Conversational**: More human-like interactions
4. **Flexible**: Handles complex/ambiguous queries

## Testing

### Test 1: Mode Toggle
**Action**: Click "Product" button
**Expected**:
- Product mode active (green highlight)
- Status shows "🟢 Safe Mode"
- Description: "Deterministic logic only, no API calls"

**Action**: Click "Analyst" button
**Expected**:
- Analyst mode active (indigo highlight)
- Status shows "🔵 AI Active" (pulsing)
- Description: "AI-powered insights with Gemini API"

### Test 2: Confirmation Intent (Product Mode)
**Input**: "yes"
**Expected**: Proceeds to next step (deterministic pattern match)

**Input**: "no"
**Expected**: Returns to editing (deterministic pattern match)

**Input**: "maybe later"
**Expected**: "unknown" → user prompted to clarify

### Test 3: Feature Summary (Product Mode)
**Trigger**: Confirm 5 channels for feature engineering
**Expected**: Deterministic summary with channel count

### Test 4: No API Calls (Product Mode)
**Validation**: Monitor network tab while using Product mode
**Expected**: Zero requests to Gemini API

### Test 5: Full Workflow (Product Mode)
**Action**: Complete entire MMM workflow in Product mode
**Expected**:
- All steps complete successfully
- No errors or API failures
- Consistent responses across runs
- Instant responses (no loading delays)

## Files Created

1. **services/deterministicResponses.ts** (213 lines)
   - Pre-written responses for all steps
   - Rule-based confirmation intent
   - Deterministic summaries

2. **components/ProductModeToggle.tsx** (63 lines)
   - Toggle UI component
   - Mode indicator
   - Status badge

3. **PRODUCT_MODE_FEATURE.md** (this file)
   - Complete documentation

## Files Modified

1. **App.tsx**
   - Line 57: Added `productMode` state (default true)
   - Lines 50-56: Import deterministic services
   - Line 1515-1517: Product mode check for column confirmation
   - Line 1585-1587: Product mode check for EDA confirmation
   - Line 1667-1669: Product mode check for feature confirmation
   - Line 1736-1738: Product mode check for finalization
   - Lines 2423-2428: Render ProductModeToggle in UI

## Default Mode

**Product Mode is the default** (`productMode = true`) for safety reasons:
- New users don't need to configure API keys
- Demo/testing doesn't incur costs
- Offline usage works out-of-box
- Predictable behavior for showcasing

Users can toggle to Analyst mode when:
- They have a Gemini API key configured
- They want AI-enhanced interactions
- They need natural language understanding
- They're comfortable with API costs

## Future Enhancements

1. **Mode Persistence**: Save mode preference to localStorage
2. **API Key Detection**: Auto-enable Analyst mode if key is present
3. **Hybrid Mode**: Use deterministic for confirmations, AI for insights
4. **Mode Analytics**: Track which mode users prefer
5. **Advanced Deterministic Logic**: More sophisticated pattern matching
6. **Multi-Language Support**: Deterministic responses in multiple languages

## Critical Rules

### ✅ DO
- Default to Product mode for safety
- Make mode toggle prominent and clear
- Ensure all critical paths work in Product mode
- Test both modes thoroughly
- Document which features require Analyst mode (if any)

### ❌ DON'T
- Make API calls in Product mode (defeats the purpose)
- Hide the mode toggle from users
- Require Analyst mode for core functionality
- Use complex heuristics that might fail unpredictably

## Known Limitations

### Product Mode Limitations
1. **Simple Intent Detection**: Can't handle complex/ambiguous queries
2. **Static Responses**: No personalization or context awareness
3. **Limited Flexibility**: Can't adapt to unusual user inputs
4. **Pattern-Based**: May miss edge cases not in pattern list

### Analyst Mode Limitations
1. **Requires API Key**: Won't work without Gemini API configured
2. **Network Dependency**: Needs internet connection
3. **Cost**: API usage charges apply
4. **Latency**: Network delays for each AI call
5. **Non-Deterministic**: Same input may produce different outputs

## Success Metrics

- **Product mode adoption**: % of sessions using Product mode
- **Zero API errors**: No API failures in Product mode
- **Response time**: <100ms for all deterministic responses
- **Workflow completion**: 100% success rate in Product mode
- **User satisfaction**: Clear understanding of mode differences
