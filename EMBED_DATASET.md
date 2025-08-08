# 🚀 How to Embed Your Dataset for Demo Mode

This guide shows you how to embed your own marketing mix modeling dataset so the app loads it automatically, creating a seamless demo experience.

## 📁 Step 1: Place Your Dataset

1. **Save your CSV file** as `demo-dataset.csv` 
2. **Put it in the `public` folder**: `/public/demo-dataset.csv`

```
agentic-marketing-mix-modeling-(mmx)---v9.1/
├── public/
│   └── demo-dataset.csv  ← Your dataset goes here
├── src/
├── services/
└── ...
```

## 📊 Step 2: Dataset Requirements

Your CSV should include these column types:

### ✅ Required Columns:
- **Time Dimension**: Date/Week column (e.g., `Week`, `Date`, `Period`)
- **Dependent Variable**: Your KPI (e.g., `Sales`, `Prescriptions`, `Revenue`) 
- **Marketing Spend**: At least one spend column (e.g., `TV_Spend`, `Digital_Spend`)

### 🎯 Optional but Recommended:
- **Marketing Activity**: Volume metrics (`TV_Impressions`, `Search_Clicks`)
- **Control Variables**: External factors (`Seasonality`, `Promotions`, `Weather`)
- **Geo Dimension**: Geographic identifier if applicable (`Market_ID`, `Region`)

### 📋 Example Column Structure:
```csv
Week,Sales,TV_Spend,Digital_Spend,TV_Impressions,Search_Clicks,Seasonality
2023-W01,150000,25000,8000,1200000,45000,0.8
2023-W02,165000,30000,9000,1400000,52000,0.9
...
```

## 🎪 Step 3: Demo Experience

Once your dataset is in place:

### **🤖 Agent Behavior:**
- App loads with personalized greeting about YOUR data
- Shows "🚀 Load Demo Dataset" button automatically  
- Agent acts like it knows your business context
- Provides insights specific to your columns and metrics

### **💬 User Experience:**
- No more manual CSV uploads for demos!
- Agent feels knowledgeable and prepared
- Smooth, professional presentation flow
- Real statistical analysis on your actual data

## 🔧 Step 4: Test Your Setup

1. **Place your CSV**: Save as `/public/demo-dataset.csv`
2. **Build the app**: `npm run build`
3. **Serve locally**: `npm run preview` 
4. **Test demo mode**: Look for the "🚀 Load Demo Dataset" button

## ⚡ Demo Flow

```
1. App loads → Agent greets with dataset context
2. User clicks "🚀 Load Demo Dataset" or types "load demo"
3. Agent loads your CSV automatically  
4. Column analysis happens instantly
5. Ready for MMx workflow with YOUR data!
```

## 🎯 Pro Tips

### **For Best Demo Results:**
- **Use realistic data** (not synthetic) for credibility
- **Include proper spend columns** for ROI calculations
- **50-200 rows** works well for demos
- **Clear column names** help with auto-classification

### **Column Naming Hints:**
- `TV_Spend`, `Digital_Spend` → Auto-classified as Marketing Spend
- `TV_Impressions`, `Search_Clicks` → Marketing Activity  
- `Sales`, `Revenue`, `Prescriptions` → Dependent Variable
- `Week`, `Date`, `Period` → Time Dimension

## 🚫 Fallback Mode

If no `demo-dataset.csv` is found:
- App falls back to standard upload-only mode
- No demo button appears
- Regular "Upload CSV Data" experience

---

**Ready to impress?** Drop your CSV in `/public/demo-dataset.csv` and watch your MMx agent become a data expert! 🎭✨