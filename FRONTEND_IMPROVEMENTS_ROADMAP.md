# Frontend Improvements Roadmap

This document contains comprehensive improvement suggestions for each tab of the MMM application, organized by priority.

---

## 📋 **TAB 1: WELCOME SCREEN**

### Current State
✅ Clean two-column layout (CSV upload vs Demo datasets)
✅ Feature preview cards
✅ Professional branding

### Suggested Improvements

#### 1. Add Data Requirements Preview
```tsx
// Add before feature cards
<div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg max-w-2xl mx-auto">
  <h4 className="font-semibold text-blue-900 mb-2">📋 What You'll Need</h4>
  <ul className="text-sm text-blue-800 space-y-1">
    <li>• Weekly or monthly data (min 52 weeks recommended)</li>
    <li>• Marketing channels (spend OR activity metrics)</li>
    <li>• Target KPI (sales, revenue, conversions)</li>
    <li>• Optional: Control variables (price, promotions, seasonality)</li>
  </ul>
</div>
```

#### 2. Show Recent Uploads (if any)
- Add localStorage tracking of recent datasets
- Display "Resume Previous Analysis" option
- Show last 3 uploaded datasets with date/status badges

#### 3. Add CSV Template Download
```tsx
<button className="text-sm text-gray-600 hover:text-[#EC7200] underline">
  Download CSV Template →
</button>
```

#### 4. Progress Indicator Enhancement
- Show "Step 1 of 7" badge
- Add visual workflow diagram showing all steps

---

## 📋 **TAB 2: CONFIGURE (Column Assignment)**

### Current State
✅ Grid layout for column configuration
✅ Channel ownership assignment
✅ AI suggested badges

### Suggested Improvements

#### 1. Add Visual Column Grouping
```tsx
// Group columns by type before rendering
const groupedColumns = {
  'Core Columns': [time, geo, dependent],
  'Marketing Channels': [marketing_activity, marketing_spend],
  'Control Variables': [controls],
  'Other': [ignore]
};

// Render with collapsible sections
<Accordion sections={groupedColumns} />
```

#### 2. Missing Column Warnings ⭐ HIGH PRIORITY
```tsx
{!hasTimeColumn && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
    <p className="text-sm text-yellow-800">
      ⚠️ No TIME_DIMENSION detected. MMM requires time-series data.
    </p>
  </div>
)}
```

#### 3. Channel Ownership Enhancement
- Add **visual examples** (TV icon for GEO, mobile icon for CUSTOMER)
- Show **recommendation badges** per channel
- Add "Auto-Assign Based on Best Practices" button

```tsx
const autoAssign = () => {
  const auto = {};
  marketingChannels.forEach(ch => {
    if (ch.name.match(/tv|ctv|radio|ooh|print/i)) auto[ch.name] = 'GEO';
    else if (ch.name.match(/digital|email|sms|search|social/i)) auto[ch.name] = 'CUSTOMER';
    else auto[ch.name] = 'SHARED';
  });
  onOwnershipChange(auto);
};
```

#### 4. Add Data Preview
- Show first 5 rows of each column
- Display data type and sample values
- Help users verify column assignments

#### 5. Validation Summary Before Proceed
```tsx
<div className="bg-green-50 p-4 rounded-lg">
  <h4 className="font-semibold text-green-900">✓ Configuration Summary</h4>
  <ul className="text-sm text-green-800">
    <li>• {marketingChannels.length} marketing channels detected</li>
    <li>• {controlColumns.length} control variables</li>
    <li>• Time grain: {grain || 'Auto-detected'}</li>
    <li>• CUSTOMER channels: {customerChannels.length}</li>
    <li>• GEO channels: {geoChannels.length}</li>
  </ul>
</div>
```

---

## 📋 **TAB 3: DATA VALIDATION**

### Current State
✅ Three tabs (Diagnostics, Correlation, Sparsity)
✅ Sales trend chart
✅ Channel diagnostics table

### Suggested Improvements

#### 1. Add Data Quality Score ⭐ HIGH PRIORITY
```tsx
const calculateDataQualityScore = () => {
  let score = 100;
  if (avgSparsity > 50) score -= 20;
  if (avgVolatility > 2) score -= 15;
  if (highCorrelation > 3) score -= 15;
  if (insufficientData) score -= 30;
  return Math.max(0, score);
};

<div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl mb-6">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-2xl font-bold">{dataQualityScore}/100</h3>
      <p>Data Quality Score</p>
    </div>
    <div className="text-5xl opacity-50">
      {dataQualityScore >= 80 ? '😊' : dataQualityScore >= 60 ? '😐' : '😟'}
    </div>
  </div>
</div>
```

#### 2. Add Anomaly Detection to Trend Chart
```tsx
// Mark outliers on the sales trend
const detectOutliers = (data) => {
  const mean = data.reduce((a,b) => a + b.kpi, 0) / data.length;
  const std = Math.sqrt(data.reduce((a,b) => a + Math.pow(b.kpi - mean, 2), 0) / data.length);
  return data.filter(d => Math.abs(d.kpi - mean) > 2 * std);
};

// Add scatter layer for outliers
<Scatter data={outliers} fill="red" />
```

#### 3. Enhance Channel Table with Bulk Actions
```tsx
// Add bulk actions
<div className="mb-4 flex gap-2">
  <button onClick={() => approveAll()}>Approve All ✓</button>
  <button onClick={() => excludeHighSparsity()}>Exclude Sparse Channels</button>
  <button onClick={() => excludeHighVolatility()}>Exclude Volatile Channels</button>
</div>
```

#### 4. Add Correlation Insights Panel
```tsx
<div className="mb-6 grid grid-cols-3 gap-4">
  <MetricCard
    title="High Correlations"
    value={highCorrPairs.length}
    warning={highCorrPairs.length > 0}
    subtitle="Pairs with r > 0.7"
  />
  <MetricCard
    title="Perfect Independence"
    value={lowCorrPairs.length}
    subtitle="Pairs with |r| < 0.2"
  />
  <MetricCard
    title="Recommended Action"
    value={highCorrPairs.length > 3 ? 'Review' : 'Proceed'}
  />
</div>
```

#### 5. Interactive Correlation Heatmap (instead of table)
```tsx
import { HeatMapGrid } from 'react-grid-heatmap';

<HeatMapGrid
  data={correlationMatrix}
  xLabels={channels}
  yLabels={channels}
  cellRender={(x, y, value) => (
    <div className="cursor-pointer hover:scale-110">
      {value.toFixed(2)}
    </div>
  )}
  cellStyle={(x, y, value) => ({
    background: `rgba(255, 0, 0, ${Math.abs(value) * 0.8})`,
    fontSize: "11px"
  })}
/>
```

#### 6. Add Sparsity Heatmap Timeline
```tsx
// Show when each channel was active (week-by-week grid)
<div className="overflow-x-auto">
  {channels.map(ch => (
    <div key={ch} className="flex gap-1 mb-2">
      <span className="w-32 text-sm">{ch}</span>
      {weeks.map(week => (
        <div
          key={week}
          className={`w-2 h-6 ${data[ch][week] > 0 ? 'bg-green-500' : 'bg-gray-200'}`}
          title={`Week ${week}: ${data[ch][week]}`}
        />
      ))}
    </div>
  ))}
</div>
```

#### 7. Add "Flight Pattern" Detection
```tsx
// Identify intentional "flighting" vs missing data
const detectFlighting = (channel) => {
  const gaps = findZeroGaps(channel);
  const avgGapLength = gaps.reduce((a,b) => a + b.length, 0) / gaps.length;
  return avgGapLength > 4 && avgGapLength < 8; // Likely intentional
};
```

#### 8. Add "Data Validation Report" Export
```tsx
<button onClick={() => exportValidationReport()}>
  📄 Export Validation Report (PDF)
</button>
```

---

## 📋 **TAB 4: FEATURE ENGINEERING**

### Current State
✅ Parameter table with dual-range sliders
✅ AI rationale per channel
✅ Lock functionality

### Suggested Improvements

#### 1. Add Visual Parameter Preview
```tsx
// Show adstock effect visually
<div className="grid grid-cols-2 gap-4">
  <div>
    <h4>Original Activity</h4>
    <LineChart data={original} />
  </div>
  <div>
    <h4>After Adstock (decay={decay})</h4>
    <LineChart data={adstocked} />
  </div>
</div>
```

#### 2. Parameter Presets ⭐ HIGH PRIORITY
```tsx
const presets = {
  'TV/Brand': { adstockMin: 0.6, adstockMax: 0.9, lagMin: 0, lagMax: 4 },
  'Digital': { adstockMin: 0.2, adstockMax: 0.5, lagMin: 0, lagMax: 2 },
  'Email/SMS': { adstockMin: 0.0, adstockMax: 0.3, lagMin: 0, lagMax: 1 }
};

<button onClick={() => applyPreset(channel, presets[channelType])}>
  Apply {channelType} Preset
</button>
```

#### 3. Add Transformation Preview
```tsx
// Show before/after transformation
<div className="flex gap-4">
  <MiniChart title="Raw" data={raw} />
  <ArrowRight />
  <MiniChart title={transformation} data={transformed} />
</div>
```

#### 4. Batch Parameter Editing ⭐ MEDIUM PRIORITY
```tsx
// Apply same parameters to multiple channels
<div className="bg-gray-50 p-4 rounded-lg mb-4">
  <h4>Bulk Edit</h4>
  <div className="flex gap-2">
    <MultiSelect options={channels} />
    <RangeSlider label="Adstock" />
    <button>Apply to Selected</button>
  </div>
</div>
```

#### 5. Parameter Sensitivity Indicator
```tsx
// Show which parameters matter most
<div className="text-xs text-gray-500">
  Sensitivity:
  <span className="text-red-600">Adstock (High)</span>,
  <span className="text-yellow-600">Lag (Medium)</span>,
  <span className="text-green-600">Transform (Low)</span>
</div>
```

---

## 📋 **TAB 5: MODELING (Dual Model View)**

### Current State
✅ Three tabs (CUSTOMER, GEO, Consistency)
✅ Model leaderboard
✅ Consistency scoring
✅ Recalibration wizard

### Suggested Improvements

#### 1. Add Model Cards (instead of table for top 3)
```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  {topModels.map((model, i) => (
    <ModelCard
      model={model}
      rank={i + 1}
      isRecommended={i === 0}
      onSelect={() => selectModel(model)}
    />
  ))}
</div>
```

#### 2. Add Filtering/Sorting Controls
```tsx
<div className="flex gap-2 mb-4">
  <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
    All Models ({models.length})
  </FilterButton>
  <FilterButton active={filter === 'bayesian'} onClick={() => setFilter('bayesian')}>
    Bayesian Only ({bayesianCount})
  </FilterButton>
  <FilterButton active={filter === 'high-r2'} onClick={() => setFilter('high-r2')}>
    R² > 0.8 ({highR2Count})
  </FilterButton>
</div>
```

#### 3. Add Interactive Waterfall Chart
```tsx
// Show contribution breakdown as waterfall
<WaterfallChart
  data={[
    { name: 'Baseline', value: baseline },
    ...channels.map(ch => ({ name: ch.name, value: ch.contribution })),
    { name: 'Total', value: totalSales, isTotal: true }
  ]}
/>
```

#### 4. Add "What-If" Scenario Builder ⭐ HIGH PRIORITY
```tsx
<div className="bg-blue-50 p-4 rounded-lg">
  <h4>🎯 What-If Analysis</h4>
  <p className="text-sm mb-3">See predicted impact of spend changes</p>
  {channels.map(ch => (
    <div key={ch} className="flex items-center gap-2 mb-2">
      <span className="w-32 text-sm">{ch}</span>
      <input
        type="number"
        value={whatIf[ch]}
        onChange={(e) => updateWhatIf(ch, e.target.value)}
        className="w-32"
      />
      <span className="text-sm text-gray-600">
        Predicted Impact: +{calculateImpact(ch, whatIf[ch])}
      </span>
    </div>
  ))}
</div>
```

#### 5. Add Visual Agreement Gauge ⭐ MEDIUM PRIORITY
```tsx
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';

<div className="flex justify-center mb-6">
  <div style={{ width: 200 }}>
    <CircularProgressbar
      value={overallAgreement}
      text={`${overallAgreement}%`}
      styles={buildStyles({
        pathColor: overallAgreement >= 80 ? '#10b981' : overallAgreement >= 60 ? '#f59e0b' : '#ef4444',
        textColor: '#1f2937'
      })}
    />
    <p className="text-center mt-2 font-semibold">Overall Agreement</p>
  </div>
</div>
```

#### 6. Add Conflict Resolution Wizard
```tsx
{conflictingChannels.length > 0 && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
    <h4 className="font-semibold mb-2">🔧 Resolve Conflicts</h4>
    <button onClick={() => openConflictWizard()}>
      Step-by-Step Conflict Resolution →
    </button>
  </div>
)}
```

#### 7. Add Channel Agreement Heatmap
```tsx
// Visual grid showing agreement per channel per metric
<table className="w-full">
  <thead>
    <tr>
      <th>Channel</th>
      <th>Contribution %</th>
      <th>ROI</th>
      <th>Coefficient</th>
      <th>Overall</th>
    </tr>
  </thead>
  <tbody>
    {channels.map(ch => (
      <tr key={ch}>
        <td>{ch}</td>
        <td className={getAgreementColor(agreement[ch].contribution)}>
          {agreement[ch].contribution}%
        </td>
        <td className={getAgreementColor(agreement[ch].roi)}>
          {agreement[ch].roi}%
        </td>
        <td className={getAgreementColor(agreement[ch].coefficient)}>
          {agreement[ch].coefficient}%
        </td>
        <td className={getAgreementColor(agreement[ch].overall)}>
          {agreement[ch].overall}%
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### 8. Add Model Export
```tsx
<button onClick={() => exportModel(selectedModel)}>
  💾 Export Model Config (JSON)
</button>
```

---

## 📋 **TAB 6: REPORT (Dual Model Report)**

### Current State
✅ Three tabs (CUSTOMER Report, GEO Report, Comparison)
✅ Attribution breakdown
✅ Channel results table

### Suggested Improvements

#### 1. Add Executive Summary Card ⭐ HIGH PRIORITY
```tsx
<div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-8 rounded-2xl mb-6">
  <h2 className="text-3xl font-bold mb-4">📊 Executive Summary</h2>
  <div className="grid grid-cols-3 gap-6">
    <div>
      <p className="text-sm opacity-90">Model Performance</p>
      <p className="text-4xl font-bold">{r2}%</p>
      <p className="text-sm">R² Score</p>
    </div>
    <div>
      <p className="text-sm opacity-90">Overall ROI</p>
      <p className="text-4xl font-bold">{roi}x</p>
      <p className="text-sm">Return on Investment</p>
    </div>
    <div>
      <p className="text-sm opacity-90">Top Channel</p>
      <p className="text-4xl font-bold">{topChannel.name}</p>
      <p className="text-sm">${topChannel.roi}x ROI</p>
    </div>
  </div>
</div>
```

#### 2. Add Interactive Attribution Chart
```tsx
// Replace static pie chart with interactive sunburst/treemap
import { Treemap } from 'recharts';

<Treemap
  data={attributionData}
  dataKey="contribution"
  stroke="#fff"
  fill="#8884d8"
  content={<CustomTreemapContent />}
/>
```

#### 3. Add Channel Deep-Dive Modals
```tsx
// Click any channel to see detailed breakdown
<ChannelModal
  channel={selectedChannel}
  metrics={{
    spend: totalSpend,
    contribution: attribution,
    roi: calculatedROI,
    mROI: marginalROI,
    elasticity: channelElasticity,
    saturation: saturationLevel
  }}
  timeSeries={contributionOverTime}
  responseCurve={responseCurveData}
/>
```

#### 4. Add Comparison Table (vs Previous Analysis)
```tsx
{previousModel && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-3">📈 vs Previous Model</h3>
    <table className="w-full">
      <thead>
        <tr>
          <th>Channel</th>
          <th>Previous ROI</th>
          <th>Current ROI</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {channels.map(ch => (
          <tr key={ch}>
            <td>{ch}</td>
            <td>{previousModel[ch].roi}</td>
            <td>{currentModel[ch].roi}</td>
            <td className={getDeltaColor(delta)}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

#### 5. Add Download Options
```tsx
<div className="flex gap-2">
  <button onClick={() => downloadPDF()}>📄 Download PDF Report</button>
  <button onClick={() => downloadExcel()}>📊 Download Excel</button>
  <button onClick={() => downloadPPT()}>📽️ Download PowerPoint</button>
  <button onClick={() => copyToClipboard()}>📋 Copy Summary</button>
</div>
```

#### 6. Add Recommendations Panel
```tsx
<div className="bg-green-50 border-l-4 border-green-500 p-6 mb-6">
  <h3 className="text-lg font-semibold text-green-900 mb-4">💡 Key Recommendations</h3>
  <ol className="space-y-3 text-green-800">
    <li className="flex gap-3">
      <span className="font-bold">1.</span>
      <div>
        <strong>Increase {topOpportunity.channel} spend by {topOpportunity.increase}%</strong>
        <p className="text-sm">Expected lift: ${topOpportunity.expectedLift}k revenue</p>
      </div>
    </li>
    <li className="flex gap-3">
      <span className="font-bold">2.</span>
      <div>
        <strong>Reduce {lowPerformer.channel} spend by {lowPerformer.decrease}%</strong>
        <p className="text-sm">Reallocate ${lowPerformer.budget}k to higher ROI channels</p>
      </div>
    </li>
    <li className="flex gap-3">
      <span className="font-bold">3.</span>
      <div>
        <strong>Test {testChannel.channel} with ${testChannel.testBudget}k</strong>
        <p className="text-sm">Validate model predictions with controlled experiment</p>
      </div>
    </li>
  </ol>
</div>
```

---

## 📋 **TAB 7: OPTIMIZE**

### Current State
✅ Scenario selector
✅ Channel allocation table
✅ Constraint controls

### Suggested Improvements

#### 1. Add Optimization Goal Selector ⭐ HIGH PRIORITY
```tsx
<div className="bg-white p-6 rounded-xl shadow-md mb-6">
  <h3 className="font-semibold mb-4">🎯 Optimization Goal</h3>
  <div className="grid grid-cols-3 gap-4">
    <GoalCard
      active={goal === 'max-revenue'}
      title="Maximize Revenue"
      description="Highest total sales"
      icon="📈"
      onClick={() => setGoal('max-revenue')}
    />
    <GoalCard
      active={goal === 'max-roi'}
      title="Maximize Efficiency"
      description="Best return per dollar"
      icon="💰"
      onClick={() => setGoal('max-roi')}
    />
    <GoalCard
      active={goal === 'constrained'}
      title="Custom Constraints"
      description="Balance multiple objectives"
      icon="⚖️"
      onClick={() => setGoal('constrained')}
    />
  </div>
</div>
```

#### 2. Add Scenario Comparison Visualization
```tsx
// Compare multiple scenarios side-by-side
<div className="grid grid-cols-2 gap-6 mb-6">
  <ScenarioCard scenario={baseline} label="Current" />
  <ScenarioCard scenario={optimized} label="Optimized" highlighted />
</div>

<div className="bg-blue-50 p-6 rounded-xl">
  <h4 className="font-semibold mb-3">Impact Summary</h4>
  <div className="grid grid-cols-4 gap-4">
    <MetricDelta label="Revenue" delta={revenueDelta} />
    <MetricDelta label="ROI" delta={roiDelta} />
    <MetricDelta label="Spend" delta={spendDelta} />
    <MetricDelta label="Efficiency" delta={efficiencyDelta} />
  </div>
</div>
```

#### 3. Add Interactive Budget Slider
```tsx
// Visual budget allocation with drag-and-drop
<div className="mb-6">
  <h4 className="font-semibold mb-3">Budget Allocation</h4>
  <div className="relative h-16 bg-gray-200 rounded-lg flex">
    {channels.map(ch => (
      <div
        key={ch}
        draggable
        style={{ width: `${allocation[ch]}%` }}
        className="h-full flex items-center justify-center cursor-move hover:opacity-80"
        style={{ background: ch.color }}
      >
        <span className="text-white text-sm font-semibold">
          {ch.name}: {allocation[ch]}%
        </span>
      </div>
    ))}
  </div>
</div>
```

#### 4. Add Constraint Presets ⭐ MEDIUM PRIORITY
```tsx
const constraintPresets = {
  'Conservative': { maxChange: 10, minSpend: 0.8, maxSpend: 1.2 },
  'Moderate': { maxChange: 25, minSpend: 0.5, maxSpend: 1.5 },
  'Aggressive': { maxChange: 50, minSpend: 0, maxSpend: 2.0 }
};

<div className="flex gap-2 mb-4">
  {Object.entries(constraintPresets).map(([name, preset]) => (
    <button
      key={name}
      onClick={() => applyConstraintPreset(preset)}
      className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
    >
      {name}
    </button>
  ))}
</div>
```

#### 5. Add Monte Carlo Sensitivity Analysis ⭐ LOW PRIORITY
```tsx
<div className="bg-purple-50 p-6 rounded-xl mb-6">
  <h4 className="font-semibold mb-3">🎲 Uncertainty Analysis</h4>
  <p className="text-sm text-gray-600 mb-4">
    Based on 1,000 simulations considering model uncertainty
  </p>
  <div className="grid grid-cols-3 gap-4">
    <div>
      <p className="text-sm text-gray-600">Expected Revenue</p>
      <p className="text-2xl font-bold">${expectedRevenue}k</p>
      <p className="text-xs text-gray-500">80% CI: ${lowerBound}k - ${upperBound}k</p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Risk of Loss</p>
      <p className="text-2xl font-bold">{lossProb}%</p>
      <p className="text-xs text-gray-500">Probability revenue < baseline</p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Upside Potential</p>
      <p className="text-2xl font-bold">+${upsidePotential}k</p>
      <p className="text-xs text-gray-500">90th percentile outcome</p>
    </div>
  </div>
</div>
```

#### 6. Add Scenario Export & Sharing
```tsx
<div className="flex gap-2">
  <button onClick={() => saveScenario()}>💾 Save Scenario</button>
  <button onClick={() => exportToExcel()}>📊 Export to Excel</button>
  <button onClick={() => shareLink()}>🔗 Share Link</button>
  <button onClick={() => scheduleReport()}>📅 Schedule Report</button>
</div>
```

---

## 🌐 **CROSS-CUTTING IMPROVEMENTS (All Tabs)**

### 1. Enhanced Agent Panel
- Add **priority ranking** (HIGH/MEDIUM/LOW with color badges)
- Show **estimated time** per action
- Add **"Dismiss"** option for actions
- Add **"Explain More"** button that opens detailed modal

### 2. Decision Log Enhancements
- Add **search/filter** functionality
- Add **timeline view** (vertical timeline with icons)
- Add **export** to PDF/CSV
- Add **undo** functionality (revert recent decisions)

### 3. Product Mode Improvements
- Add **"Why Product Mode?"** tooltip explaining benefits
- Show **API call savings** counter when in Product Mode
- Add **transition animation** when switching modes

### 4. Progressive Disclosure
- Add **"Advanced Options"** collapsible sections
- Hide complexity by default, show on click
- Add **"Guided Mode" vs "Expert Mode"** toggle

### 5. Keyboard Shortcuts
```tsx
// Add shortcuts panel
<KeyboardShortcutsModal shortcuts={{
  'Ctrl+Enter': 'Proceed to next step',
  'Ctrl+B': 'Go back',
  'Ctrl+D': 'Open Decision Log',
  'Ctrl+S': 'Save current state',
  'Ctrl+E': 'Export current view'
}} />
```

### 6. Add Breadcrumb Navigation
```tsx
<nav className="flex items-center space-x-2 mb-6">
  {steps.map((step, i) => (
    <>
      <button
        onClick={() => goToStep(step)}
        className={`text-sm ${i <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'}`}
      >
        {step.name}
      </button>
      {i < steps.length - 1 && <ChevronRight />}
    </>
  ))}
</nav>
```

### 7. Add Onboarding Tour
```tsx
import Joyride from 'react-joyride';

<Joyride
  steps={tourSteps}
  run={isFirstVisit}
  continuous
  showSkipButton
/>
```

### 8. Add Analytics Tracking
```tsx
// Track user interactions for product improvement
useEffect(() => {
  trackPageView(currentStep);
  trackInteraction('step_changed', { from: prevStep, to: currentStep });
}, [currentStep]);
```

---

## 🎯 **PRIORITY IMPLEMENTATION ORDER**

### **Phase 1: High Priority** (Implement First)
1. ⭐ Data Quality Score (Validation tab)
2. ⭐ Executive Summary Card (Report tab)
3. ⭐ Optimization Goal Selector (Optimize tab)
4. ⭐ What-If Scenario Builder (Modeling tab)
5. ⭐ Missing Column Warnings (Configure tab)

### **Phase 2: Medium Priority**
6. Visual Agreement Gauge (Consistency tab)
7. Interactive Waterfall Chart (Report tab)
8. Parameter Presets (Feature Engineering tab)
9. Batch Parameter Editing (Feature Engineering tab)
10. Constraint Presets (Optimize tab)

### **Phase 3: Low Priority** (Nice to Have)
11. Monte Carlo Analysis (Optimize tab)
12. Keyboard Shortcuts
13. Onboarding Tour
14. Export to PPT/PDF
15. Drag-and-drop budget allocation

---

## 📝 **IMPLEMENTATION NOTES**

### Dependencies to Install
```bash
npm install react-grid-heatmap react-circular-progressbar react-joyride
```

### Code Structure
- Create new components in `components/` for reusable UI elements
- Add utility functions in `utils/` for calculations
- Update existing component files for inline improvements
- Test each improvement in isolation before moving to next

### Testing Checklist
- [ ] Verify all improvements work in Product Mode
- [ ] Test with demo datasets
- [ ] Test with uploaded CSV
- [ ] Verify mobile responsiveness
- [ ] Test all interactive elements
- [ ] Verify accessibility (keyboard navigation, screen readers)

---

## 🚀 **NEXT STEPS**

1. Review this roadmap with stakeholders
2. Prioritize specific improvements based on user feedback
3. Create GitHub issues for each improvement
4. Implement in phases following priority order
5. Deploy incremental updates to get user feedback early
