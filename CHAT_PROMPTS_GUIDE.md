# MMM Chat Prompts Guide

## Smart Chat Suggestions for Marketing Mix Modeling

This document provides a comprehensive list of all effective chat prompts available in the MMM application, organized by workflow step and context.

---

## 🚀 **Welcome Step**

### Primary Actions
- **"Load demo dataset"** - Instantly loads sample MMM data
- **"What data format should I use?"** - Guidance on CSV structure
- **"How does MMM work?"** - High-level MMM methodology explanation

---

## ⚙️ **Configure Step (Column Assignment)**

### Data Understanding
- **"What's the difference between Spend and Activity?"** - Key MMM concepts
- **"Why do I need a time dimension?"** - Temporal analysis importance
- **"What makes a good dependent variable?"** - KPI selection guidance

### Context-Aware (Dynamic)
- **"Explain my [X] spend channels"** - Details about classified spend columns
- **"Should I use daily or weekly data?"** - Granularity recommendations
- **"How many channels do I need for MMM?"** - Data requirements

### Natural Language Commands
- **"Ignore population, competitor spend and seasonality"** - Bulk column exclusion
- **"Set TV_Impressions to Marketing Activity"** - Individual column assignment
- **"Make all spend columns Marketing Spend"** - Bulk assignment

---

## 🔍 **Data Validation Step**

### Data Quality Analysis
- **"Explain these diagnostics"** - Overview of channel health metrics
- **"What does sparsity mean for my channels?"** - Sparsity impact explanation
- **"How do I interpret correlation patterns?"** - Correlation analysis guidance
- **"Explain the 4-week rolling average"** - Trend smoothing methodology

### Context-Aware (Smart Suggestions)
- **"Why do [X] channels have high sparsity?"** - Shown when sparsity > 50%
- **"Analyze volatile channels"** - Shown when volatility > 80%
- **"What's wrong with [Channel A] and [Channel B]?"** - Specific problematic channels
- **"Why are all channels approved?"** - When no issues detected
- **"Should I exclude problematic channels?"** - When channels need attention

### Tab Navigation
- **"Check correlation patterns"** - Switches to Correlation Matrix tab
- **"Show sparsity analysis"** - Switches to Sparsity Analysis tab
- **"Show me correlation matrix"** - Direct tab access

### Data Improvement
- **"How does this data quality look?"** - Overall assessment
- **"How can I improve my data?"** - Data enhancement suggestions
- **"What makes good MMM data?"** - Best practices

### Channel Management Commands
- **"Approve all channels"** - Bulk approval
- **"Exclude [channel name]"** - Individual channel exclusion
- **"Approve TV and Digital channels"** - Selective approval

---

## 🛠️ **Feature Engineering Step**

### MMM Concepts
- **"What is adstock and why does it matter?"** - Carryover effects explanation
- **"How were these transformations chosen?"** - Algorithm selection rationale
- **"What's the difference between S-curve and linear?"** - Transformation comparison

### Context-Aware
- **"Why do [X] channels have high adstock?"** - When adstock > 0.5
- **"Explain the lag effects in my model"** - When lag periods detected
- **"Which channels need saturation curves?"** - Transformation recommendations

### Parameter Adjustment
- **"Increase adstock for TV channels"** - Parameter modification
- **"Apply S-curve to all digital channels"** - Bulk transformation
- **"Set lag to 2 weeks for awareness channels"** - Specific adjustments

---

## 📊 **Modeling Step**

### Model Performance
- **"Which model performs best and why?"** - Leaderboard analysis
- **"How do I interpret these metrics?"** - R², MAPE, ROI explanation
- **"Compare all model algorithms"** - Algorithm comparison

### Context-Aware
- **"Why does [Algorithm] work well here?"** - Algorithm-specific insights
- **"Calibrate [model_id]"** - Model-specific calibration
- **"What makes this model reliable?"** - Performance validation

### Model Selection
- **"Select the best performing model"** - Auto-selection
- **"Run more model variations"** - Additional modeling
- **"Explain channel contributions"** - Attribution analysis

---

## 📈 **Report Step**

### Results Analysis
- **"Summarize the key findings"** - Executive summary
- **"Which channels drive the most ROI?"** - ROI ranking
- **"How should I present these results?"** - Stakeholder communication

### Context-Aware
- **"Explain all [X] channel contributions"** - When multiple channels included
- **"Why is [Channel] performing poorly?"** - Underperforming channels
- **"What's driving the high ROI in [Channel]?"** - Top performers

### Business Impact
- **"What are my biggest opportunities?"** - Optimization insights
- **"Which channels should I increase?"** - Growth recommendations
- **"How confident are these results?"** - Model reliability

---

## 💰 **Optimization Step**

### Budget Planning
- **"How was this allocation calculated?"** - Algorithm explanation
- **"Create a custom budget scenario"** - New scenario generation
- **"What if I increase budget by 20%?"** - Scenario modeling

### Context-Aware
- **"Compare all [X] scenarios"** - When multiple scenarios exist
- **"Why is [Channel] getting more budget?"** - Allocation rationale
- **"What's the ROI of this plan?"** - Performance prediction

### Scenario Commands
- **"Create aggressive growth scenario"** - High-growth planning
- **"Optimize for maximum ROI"** - Efficiency focused
- **"Maintain current spend ratios"** - Proportional scaling

---

## 🔄 **Cross-Step Commands**

### Navigation
- **"Go to [step name]"** - Direct navigation
- **"Proceed to feature engineering"** - Next step progression
- **"Go back to data validation"** - Previous step return

### Data Exploration
- **"Show me the raw data"** - Data inspection
- **"Export current results"** - Data download
- **"Reset all parameters"** - Fresh start

### Help & Guidance
- **"What should I do next?"** - Workflow guidance
- **"Explain this step"** - Current step overview
- **"How long does modeling take?"** - Process expectations

---

## 🧠 **Natural Language Processing Capabilities**

### Column Management
```
✅ "ignore population, competitor spend and seasonality"
✅ "set TV_Impressions to Marketing Activity" 
✅ "make all spend columns Marketing Spend"
✅ "exclude channels with high sparsity"
```

### Channel Analysis
```
✅ "approve TV and Digital channels"
✅ "exclude problematic channels"
✅ "what's wrong with HCP channels?"
✅ "analyze correlation between TV and Digital"
```

### Model Operations
```
✅ "select the best model"
✅ "calibrate the top model"
✅ "run models with these parameters"
✅ "finalize this model"
```

### Optimization Commands
```
✅ "create a growth scenario"
✅ "increase budget by 15%"
✅ "optimize for maximum ROI"
✅ "what if I cut TV spend?"
```

---

## 💡 **Pro Tips**

### Best Practices
1. **Be Specific**: "Analyze TV correlation" vs "Check correlation"
2. **Use Channel Names**: Reference actual channel names from your data
3. **Ask Follow-ups**: Build on previous responses for deeper insights
4. **Combine Commands**: "Approve digital channels and proceed to features"

### Advanced Queries
- **"Why is my model R² only 0.65?"** - Performance diagnostics
- **"Which transformation should I use for awareness media?"** - Expert guidance
- **"How do I explain incrementality to stakeholders?"** - Communication help
- **"What's the statistical significance of my results?"** - Validation questions

### Troubleshooting
- **"My data looks wrong, what should I check?"** - Data quality debugging
- **"The model isn't converging, what's happening?"** - Technical issues
- **"Why are all my channels showing similar ROI?"** - Model interpretation

---

## 📋 **Quick Reference**

### Most Useful Commands by Step:
- **Configure**: "Load demo dataset", "ignore [column names]"
- **Validate**: "Explain diagnostics", "approve all channels" 
- **Features**: "What is adstock?", "run models"
- **Modeling**: "Select best model", "calibrate [model]"
- **Report**: "Summarize findings", "which channels drive ROI?"
- **Optimize**: "Create growth scenario", "increase budget by X%"

### Universal Commands:
- **"What should I do next?"**
- **"Explain this step"**  
- **"Go to [step name]"**
- **"Show me the data"**

---

*This guide covers all documented chat prompts and natural language commands available in the MMM application. The system learns from context and provides smart suggestions based on your data patterns and conversation history.*