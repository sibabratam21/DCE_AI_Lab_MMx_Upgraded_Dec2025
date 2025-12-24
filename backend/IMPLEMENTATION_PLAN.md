# Bayesian MMM Backend Implementation Plan

This document outlines the complete implementation of a PyMC-based Bayesian MMM backend.

## Status: IMPLEMENTATION REQUIRED

The full implementation requires approximately **2,000-3,000 lines of Python code** across multiple files. Given the context limitations, I recommend implementing this in phases or using this plan as a specification for development.

## What Has Been Created

1. ✅ `/backend` folder structure (core/, api/, artifacts/, sample_data/)
2. ✅ `requirements.txt` with all dependencies
3. ✅ `core/storage.py` - File system utilities

## What Needs To Be Implemented

### Phase 1: Core Backend (Priority: HIGH)

#### 1. `core/status.py` (~100 lines)
```python
# Status tracking with JSON-based state management
# Stages: CREATED, VALIDATED, FEATURES_BUILT, TRAINING, TRAINED, OUTPUTS_READY, ERROR
# Functions: update_status(), get_status(), set_error()
```

#### 2. `core/validation.py` (~200 lines)
```python
# Validate dataset structure and quality
# - Check required columns (entity_id, period_start, sales)
# - Detect grain (WEEK/MONTH) from period deltas
# - Check uniqueness of (entity_id, period_start)
# - Report missingness rates
# - Output validation_summary.json
```

#### 3. `core/canonicalize.py` (~150 lines)
```python
# Standardize dataset to canonical format
# - Parse dates
# - Detect act_*, ctrl_*, spend_* columns
# - Create standardized column names
# - Aggregate to brand-time level (sum sales, sum activity, avg controls)
# - Save canonical_data.parquet
```

#### 4. `core/features.py` (~300 lines)
```python
# Feature engineering pipeline
# - Geometric adstock: y[t] = x[t] + decay * y[t-1]
# - Hill saturation (optional, v1 uses fixed params)
# - Fourier seasonality terms (K harmonics)
# - Trend term (scaled 0..T-1)
# - Z-score standardization (save scaler params)
# - Output features.parquet and feature_scaler.json
```

#### 5. `core/model_pymc.py` (~400 lines)
```python
# PyMC Bayesian MMM implementation
# Model specification:
#   log(y + eps) ~ StudentT(nu, mu, sigma)
#   mu = intercept + X_channels @ beta + X_controls @ gamma
#   intercept ~ Normal(0, 2)
#   sigma_beta ~ HalfNormal(0.5)  # hierarchical shrinkage
#   beta[c] ~ HalfNormal(sigma_beta)  # non-negative channel effects
#   gamma[j] ~ Normal(0, 0.5)
#   sigma ~ HalfNormal(1.0)
#   nu ~ Exponential(1/10)
#
# Sampling: draws=1000, tune=1000, chains=2, target_accept=0.9
# Save posterior.nc (ArviZ InferenceData)
# Save posterior_summary.json (mean, hdi_3%, hdi_97%)
```

#### 6. `core/diagnostics.py` (~150 lines)
```python
# Compute PyMC diagnostics
# - R-hat for all parameters
# - Effective sample size (ESS)
# - Divergences count
# - Energy diagnostics
# - Output diagnostics.json
```

#### 7. `core/contributions.py` (~250 lines)
```python
# Compute channel contributions and fitted values
# Contributions via counterfactual approach:
#   - For each channel c, compute y_hat with and without that channel
#   - Difference = incremental contribution
#   - Aggregate across posterior draws (mean, HDI)
#
# Fitted values:
#   - y_hat from full model
#   - Compute mean and HDI across draws
#
# Output:
#   - contributions.parquet (period_start, channel, contrib_mean/low/high)
#   - fitted.parquet (period_start, y, y_hat_mean/low/high)
```

### Phase 2: API Layer (Priority: HIGH)

#### 8. `api/datasets.py` (~200 lines)
```python
# FastAPI endpoints for dataset management
# POST /datasets/upload - multipart file upload
# POST /datasets/{dataset_id}/validate - validate dataset
# GET /datasets/{dataset_id} - get dataset info
```

#### 9. `api/runs.py` (~250 lines)
```python
# FastAPI endpoints for run management
# POST /runs/create - create new run with run_spec
# POST /runs/{run_id}/build_features - build features (async)
# POST /runs/{run_id}/train - train model (async with BackgroundTasks)
# GET /runs/{run_id}/status - get current status
# GET /runs/{run_id} - get run details
```

#### 10. `api/outputs.py` (~150 lines)
```python
# FastAPI endpoints for retrieving outputs
# GET /runs/{run_id}/outputs - get all output file paths + summaries
# GET /runs/{run_id}/posterior_summary - get posterior summary
# GET /runs/{run_id}/diagnostics - get diagnostics
# GET /runs/{run_id}/contributions - get contributions data
# GET /runs/{run_id}/fitted - get fitted values
```

#### 11. `app.py` (~150 lines)
```python
# FastAPI application entry point
# - Configure CORS for frontend
# - Include routers from api/
# - Add /health endpoint
# - Error handling middleware
```

### Phase 3: Sample Data & Testing (Priority: MEDIUM)

#### 12. `sample_data/mmm_sample.csv`
```csv
# Small synthetic dataset (52 weeks, 3 channels, 2 controls)
entity_id,period_start,sales,act_tv,act_digital,act_social,ctrl_price,ctrl_promo,spend_tv,spend_digital,spend_social
brand_total,2023-01-01,120500,850,1200,300,9.99,0,50000,15000,3000
brand_total,2023-01-08,125000,900,1300,350,9.99,1,52000,16000,3500
...
```

#### 13. Sample run_spec.json
```json
{
  "dataset_id": "sample_001",
  "grain": "WEEK",
  "target_col": "sales",
  "drivers": ["act_tv", "act_digital", "act_social"],
  "controls": ["ctrl_price", "ctrl_promo"],
  "feature_config": {
    "adstock": {
      "decay_default": 0.5,
      "per_channel": {},
      "max_lag": 13
    },
    "saturation": {
      "enabled": false
    },
    "seasonality": {
      "enabled": true,
      "K": 2
    },
    "trend": {
      "enabled": true
    }
  },
  "windows": {
    "carryover_months": 12,
    "estimation_months": 12
  },
  "random_seed": 42
}
```

### Phase 4: Frontend Integration (Priority: HIGH)

#### 14. Frontend `.env` configuration
```
VITE_BACKEND_URL=http://localhost:8000
VITE_REAL_MODE_ENABLED=true
```

#### 15. `services/backendService.ts` (~300 lines)
```typescript
// API client for backend
// - uploadDataset()
// - validateDataset()
// - createRun()
// - buildFeatures()
// - trainModel()
// - pollStatus()
// - getOutputs()
// - With error handling and fallback to demo mode
```

#### 16. Update `App.tsx` to add Real Mode toggle
```typescript
// Add state: const [realMode, setRealMode] = useState(false)
// Add toggle UI in sidebar
// Conditional logic: if (realMode) { call backend } else { demo }
```

## Implementation Complexity Estimate

- **Total Lines of Code**: ~2,500 lines Python + ~500 lines TypeScript
- **Implementation Time**: 8-12 hours for experienced developer
- **Testing Time**: 4-6 hours
- **Total Effort**: 12-18 hours

## Recommended Approach

### Option A: Phased Implementation (Recommended for this session)
1. Implement core backend modules first (validation, features, model)
2. Test with standalone Python scripts
3. Add API layer
4. Wire frontend
5. End-to-end testing

### Option B: Minimal Viable Product (MVP)
1. Implement only the happy path (single channel, no controls)
2. Simplified PyMC model
3. Basic API (upload, train, get results)
4. Wire frontend
5. Iterate to add features

### Option C: Use Existing MMM Library
1. Consider using `lightweight-mmm` or `pymc-marketing` instead of custom PyMC
2. Wrap library in FastAPI
3. Faster implementation but less control

## Next Steps

**Would you like me to:**

1. **Implement MVP (Option B)** - I can create a simplified working version in this session
2. **Create skeleton files with TODOs** - All files with function signatures and TODO comments
3. **Implement specific modules** - Which module should I prioritize? (e.g., PyMC model, API layer)
4. **Provide implementation scripts** - Standalone scripts you can run to generate all files

**Given context limits, I recommend Option 1 (MVP) focusing on:**
- Single aggregated model (brand-level only)
- 1-2 channels
- Basic PyMC model
- Essential API endpoints
- Simple frontend integration

This would be ~800 lines of code that I can implement in this session and you can extend later.

**Please advise which approach you prefer.**
