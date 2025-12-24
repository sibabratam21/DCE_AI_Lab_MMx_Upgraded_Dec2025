# Decision Log Panel Feature

## Overview
The Decision Log Panel is a collapsible right-side drawer that displays all agent and user decisions throughout the MMM workflow. It provides transparency and auditability without interfering with the main workflow.

## Features

### Visual Design
- **Right-side overlay drawer** with smooth slide-in/slide-out animations
- **Toggle button** fixed in top-right corner showing decision count
- **Semi-transparent backdrop** when panel is open
- **Fully responsive** 384px width panel
- **Scroll-friendly** for long decision lists

### Decision Display
Each decision card shows:
- **Icon** based on decision type (💡 RECOMMENDATION, ⚠️ WARNING, 🔒 LOCK, 🔄 OVERRIDE)
- **Summary** - Brief description of the decision
- **Step name** - Which workflow step the decision was made in
- **Timestamp** - Relative time (e.g., "2h ago", "Just now")
- **Details** - Full explanation of the decision
- **Type badge** - Color-coded by decision type
- **Status badge** - Shows ACTIVE, LOCKED, or OVERRIDDEN state

### Decision Types
1. **RECOMMENDATION** (Blue) - Agent suggestions
2. **WARNING** (Yellow) - Potential issues or risks
3. **LOCK** (Green) - Decisions that are locked and cannot be changed
4. **OVERRIDE** (Purple) - User overrides of agent recommendations

### Decision States
- **ACTIVE** - Current decision in effect
- **LOCKED** - 🔒 Decision is finalized and protected
- **OVERRIDDEN** - 🔄 Decision was superseded by another

## Usage

### For Users

#### Opening the Panel
1. Look for the **"Decision Log"** button in the top-right corner
2. Click to open the sliding panel
3. Click again (or click backdrop) to close

#### Viewing Decisions
- Decisions are sorted **newest first**
- Scroll to see older decisions
- Each decision shows when it was made and in which step
- Locked decisions are highlighted with 🔒 icon

### For Developers

#### Logging a Decision
```typescript
// In App.tsx or any component with access to logDecision helper
const decisionId = logDecision({
  step: AppStep.DataValidation,
  type: 'RECOMMENDATION',
  summary: 'Suggested column classifications',
  details: 'Agent recommended treating "revenue" as dependent variable based on column name and data distribution',
  status: 'ACTIVE'
});
```

#### Locking a Decision
```typescript
// Lock a critical decision to prevent changes
lockDecision(decisionId);
```

#### Adding Risk Flags
```typescript
// Add a risk flag to AnalysisState
const riskId = addRiskFlag({
  severity: 'HIGH',
  message: 'Insufficient data points for reliable TV attribution'
});
```

## Testing

### Quick Test in Browser Console

1. Open app at http://localhost:5173/
2. Login with password: `dce_ai_mmx_2025`
3. Open browser console (F12)
4. Paste contents of `test-decision-log-console.js`
5. Run: `testDecisionLog.seedSampleDecisions()`
6. Reload page to see 7 sample decisions

### Test Commands Available
```javascript
// Add sample data
testDecisionLog.seedSampleDecisions()

// View current decisions
testDecisionLog.viewDecisions()

// Get statistics
testDecisionLog.getStats()

// Add single test decision
testDecisionLog.addTestDecision('My test decision', 'WARNING')

// Clear all data
testDecisionLog.clearDecisions()
```

### Manual Testing Checklist
- ✅ Toggle button appears in top-right corner
- ✅ Panel slides smoothly from right when opened
- ✅ Backdrop dims main content when panel is open
- ✅ Clicking backdrop closes panel
- ✅ Decisions display with correct icons and badges
- ✅ Timestamps show relative time correctly
- ✅ Locked decisions show 🔒 icon
- ✅ Panel scrolls when many decisions present
- ✅ Empty state shows when no decisions
- ✅ Panel doesn't block main workflow interactions
- ✅ Data persists across page reloads

## Component Structure

### DecisionLogPanel.tsx
```typescript
interface DecisionLogPanelProps {
  decisions: DecisionRecord[];  // Array of decision records
  isOpen: boolean;              // Panel visibility state
  onToggle: () => void;         // Toggle handler
}
```

### Integration in App.tsx
```typescript
// State
const [isDecisionLogOpen, setIsDecisionLogOpen] = useState(false);
const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([]);

// Render (at end of main container)
{isAuthenticated && (
  <DecisionLogPanel
    decisions={decisionLog}
    isOpen={isDecisionLogOpen}
    onToggle={() => setIsDecisionLogOpen(!isDecisionLogOpen)}
  />
)}
```

## Styling Details

### Colors by Decision Type
- **RECOMMENDATION**: Blue (`bg-blue-100`, `text-blue-700`, `border-blue-300`)
- **WARNING**: Yellow (`bg-yellow-100`, `text-yellow-700`, `border-yellow-300`)
- **LOCK**: Green (`bg-green-100`, `text-green-700`, `border-green-300`)
- **OVERRIDE**: Purple (`bg-purple-100`, `text-purple-700`, `border-purple-300`)

### Colors by Status
- **ACTIVE**: White/Gray (`bg-white`, `text-gray-600`)
- **LOCKED**: Emerald (`bg-emerald-50`, `text-emerald-700`)
- **OVERRIDDEN**: Red (`bg-red-50`, `text-red-600`)

### Animations
- **Panel slide**: `transform translate-x-{0|full}` with `duration-300`
- **Backdrop fade**: `bg-opacity-20` with `transition-opacity`
- **Toggle icon rotation**: `transform rotate-{0|180deg}` with `duration-200`

## Constraints & Design Decisions

### Non-Blocking
- Panel is an **overlay** that doesn't affect main layout
- Uses `fixed` positioning with high `z-index` (40)
- Backdrop closes panel on click
- Does **not** interfere with workflow navigation

### Read-Only (Current Version)
- Displays decisions but doesn't allow editing
- Future versions may add:
  - Decision filtering by type/step
  - Decision editing/annotation
  - Export to CSV/PDF
  - Decision search

### Performance
- Decisions sorted in component (not stored sorted)
- Uses localStorage for persistence
- Minimal re-renders with proper React patterns

## Future Enhancements

### Planned Features
1. **Filtering**
   - Filter by decision type
   - Filter by workflow step
   - Filter by status (active/locked)
   - Date range filtering

2. **Search**
   - Full-text search across summaries and details
   - Highlight matching text

3. **Export**
   - Export to CSV for audit trail
   - Print-friendly view
   - PDF generation

4. **Editing** (with permissions)
   - Add notes to decisions
   - Change decision status
   - Override recommendations

5. **Analytics**
   - Decision timeline visualization
   - Decision type distribution chart
   - Agent vs user decision ratio

6. **Notifications**
   - Badge count for new decisions
   - Highlight new decisions since last view
   - Alert for high-severity warnings

## Accessibility

- Proper ARIA labels on buttons
- Keyboard navigation support (ESC to close)
- Semantic HTML structure
- Sufficient color contrast for badges

## Browser Compatibility

Tested and working on:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

## Performance Notes

- Panel renders only when authenticated
- Decisions stored in localStorage (max ~5-10MB typical)
- Minimal impact on main app performance
- Smooth 60fps animations on modern browsers

## Files Modified

- `types.ts` - Added DecisionRecord and related types
- `App.tsx` - Added state and integration
- `components/DecisionLogPanel.tsx` - New component

## Files Created

- `components/DecisionLogPanel.tsx` - Main panel component
- `test-decision-log-console.js` - Browser console test utilities
- `DECISION_LOG_FEATURE.md` - This documentation

## Support

For issues or questions:
- Check browser console for errors
- Verify localStorage is enabled
- Try clearing localStorage and reseeding test data
- Check that you're authenticated before expecting to see the panel
