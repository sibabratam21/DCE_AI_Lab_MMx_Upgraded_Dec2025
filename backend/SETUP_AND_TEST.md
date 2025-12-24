# Backend Setup and Testing Guide

## Prerequisites

- **Python 3.10 or higher** (PyMC requires Python 3.10+)
- **pip** package manager
- **macOS** (you're on Darwin 25.1.0)

## Step 1: Check Python Version

```bash
python3 --version
```

You should see Python 3.10.x or higher. If not, you'll need to upgrade Python first.

## Step 2: Create Virtual Environment

**IMPORTANT:** Always use a virtual environment to avoid conflicts with system Python.

```bash
# Navigate to backend directory
cd /Users/sibabratamohanty/Desktop/DCE_AI_Lab_MMx_v3/backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# You should see (venv) in your prompt now
```

## Step 3: Upgrade pip

```bash
pip install --upgrade pip
```

## Step 4: Install Dependencies

### Option A: Standard Installation (Try This First)

```bash
pip install -r requirements.txt
```

**Expected install time:** 5-10 minutes

**What gets installed:**
- FastAPI (web framework)
- Uvicorn (ASGI server)
- Pandas, Polars, PyArrow (data manipulation)
- **PyMC 5.10.4** (Bayesian modeling - largest package)
- ArviZ (posterior analysis)
- NumPy, SciPy (numerical computing)

### Option B: If PyMC Installation Fails

PyMC can be tricky to install. If you get errors, try:

```bash
# Install PyMC dependencies first
pip install numpy scipy

# Install PyMC with conda (more reliable for PyMC)
# First install miniconda if you don't have it:
# Download from: https://docs.conda.io/en/latest/miniconda.html

# Then:
conda install -c conda-forge pymc arviz
pip install fastapi uvicorn[standard] pandas polars pyarrow pydantic python-multipart aiofiles
```

### Option C: Minimal Test (Skip PyMC for now)

If you just want to test the API structure without training:

```bash
pip install fastapi uvicorn[standard] pandas pyarrow pydantic python-multipart aiofiles
```

## Step 5: Verify Installation

```bash
# Test imports
python3 -c "import fastapi; import pandas; import pyarrow; print('✅ Basic packages OK')"

# Test PyMC (this is the important one)
python3 -c "import pymc as pm; import arviz as az; print('✅ PyMC OK')"
```

If both print "✅", you're ready!

## Step 6: Start the Server

```bash
# Make sure you're in the backend directory with venv activated
python3 app.py
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Leave this terminal running!**

## Step 7: Test the API (New Terminal)

Open a **new terminal** (keep the server running in the first one).

### Test 1: Health Check

```bash
curl http://localhost:8000/health
```

Expected output:
```json
{"status":"healthy","artifacts_dir":"..."}
```

### Test 2: Interactive API Docs

Open in browser:
```
http://localhost:8000/docs
```

You should see Swagger UI with all endpoints!

### Test 3: Upload Sample Dataset

```bash
curl -X POST "http://localhost:8000/datasets/upload?dataset_id=test_sample" \
  -F "file=@sample_data/mmm_sample_small.csv"
```

Expected output (abbreviated):
```json
{
  "dataset_id": "test_sample",
  "status": "valid",
  "validation": {
    "row_count": 52,
    "grain": "WEEK",
    ...
  }
}
```

### Test 4: Create MMM Run (This will take 5-10 minutes)

```bash
curl -X POST "http://localhost:8000/runs/create" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "test_sample",
    "grain": "WEEK",
    "drivers": ["act_tv", "act_digital", "act_radio"],
    "controls": ["ctrl_price_index"],
    "draws": 500,
    "tune": 500,
    "chains": 2,
    "random_seed": 42
  }'
```

Expected output:
```json
{
  "run_id": "run_a1b2c3d4",
  "status": "started"
}
```

**Copy the run_id!** You'll need it for the next steps.

### Test 5: Monitor Status

```bash
# Replace run_XXXXXXXX with your actual run_id
export RUN_ID=run_XXXXXXXX

# Check status
curl "http://localhost:8000/runs/${RUN_ID}/status"
```

**Poll this every 30 seconds.** You'll see progress:
- `CREATED` → `VALIDATED` → `FEATURES_BUILT` → `TRAINING` → `TRAINED` → `OUTPUTS_READY`

**Training stage takes 5-10 minutes** for 500 draws × 2 chains.

### Test 6: Get Results (After training completes)

```bash
# Complete summary
curl "http://localhost:8000/outputs/${RUN_ID}/summary" | python3 -m json.tool

# Diagnostics (check convergence)
curl "http://localhost:8000/outputs/${RUN_ID}/diagnostics" | python3 -m json.tool

# Channel contributions
curl "http://localhost:8000/outputs/${RUN_ID}/contributions?format=summary" | python3 -m json.tool

# ROI metrics
curl "http://localhost:8000/outputs/${RUN_ID}/roi" | python3 -m json.tool
```

## Expected Results

### Good Diagnostics Look Like:
```json
{
  "overall_status": "PASS",
  "convergence": {
    "max_rhat": 1.005  // Should be < 1.01
  },
  "sampling_quality": {
    "min_ess_bulk": 850,  // Should be > 400
    "n_divergences": 0     // Should be 0
  }
}
```

### Sample Contributions:
```json
{
  "total_actual_sales": 65432.10,
  "channels": {
    "act_tv": {
      "total_contribution": 15234.50,
      "percent_of_sales": 23.3,
      "roi": 3.05
    },
    ...
  }
}
```

## Troubleshooting

### Problem: "No module named 'pymc'"
**Solution:** PyMC not installed. Try Option B above (conda install).

### Problem: "Sampling appears to have failed"
**Solution:**
- Check data quality
- Increase `target_accept` to 0.95
- Reduce model complexity (fewer channels)

### Problem: High R-hat (> 1.01)
**Solution:**
- Increase `tune` to 1000 or 2000
- Increase `target_accept` to 0.95

### Problem: Divergences > 0
**Solution:**
- Increase `target_accept` to 0.95 or 0.99
- Check for outliers in data

### Problem: "Port 8000 already in use"
**Solution:**
```bash
# Kill existing process
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn app:app --port 8001
```

## Quick Test Script

Save this as `test_backend.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Backend..."

# Health check
echo "\n1️⃣ Health check..."
curl -s http://localhost:8000/health | python3 -m json.tool

# Upload dataset
echo "\n2️⃣ Uploading dataset..."
UPLOAD_RESULT=$(curl -s -X POST "http://localhost:8000/datasets/upload?dataset_id=test_$(date +%s)" \
  -F "file=@sample_data/mmm_sample_small.csv")
echo $UPLOAD_RESULT | python3 -m json.tool

# Create run
echo "\n3️⃣ Creating run..."
RUN_RESULT=$(curl -s -X POST "http://localhost:8000/runs/create" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "test_sample",
    "grain": "WEEK",
    "drivers": ["act_tv", "act_digital", "act_radio"],
    "controls": ["ctrl_price_index"],
    "draws": 100,
    "tune": 100,
    "chains": 1
  }')

echo $RUN_RESULT | python3 -m json.tool

RUN_ID=$(echo $RUN_RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['run_id'])")

echo "\n✅ Run created: $RUN_ID"
echo "Monitor with: curl http://localhost:8000/runs/$RUN_ID/status"
```

Make it executable:
```bash
chmod +x test_backend.sh
./test_backend.sh
```

## Next Steps After Successful Test

1. ✅ Backend working
2. 🔗 Integrate with React frontend
3. 🚀 Deploy to production

## Deactivating Virtual Environment

When done testing:
```bash
deactivate
```
