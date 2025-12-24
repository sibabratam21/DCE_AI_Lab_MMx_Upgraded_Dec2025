# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup
```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Server
```bash
# From backend directory
python3 app.py

# Or with uvicorn directly
uvicorn app:app --reload --port 8000

# Access interactive API docs at http://localhost:8000/docs
```

## Project Architecture

This is a FastAPI backend for Bayesian Marketing Mix Modeling (MMM) using PyMC. It provides a REST API for uploading datasets, training Bayesian models, and retrieving model outputs.

### High-Level Architecture

The backend follows a clean separation of concerns:
- **API Layer** (`api/`) - FastAPI endpoints for HTTP requests
- **Core Layer** (`core/`) - Business logic and statistical modeling
- **Storage Layer** (`core/storage.py`) - File system abstractions for artifacts

### Complete MMM Pipeline

The backend implements a multi-stage pipeline:

1. **Dataset Upload & Validation** → `api/datasets.py` → `core/validation.py`
   - Validates CSV structure (required columns: entity_id, period_start, sales)
   - Detects time grain (WEEK/MONTH) from period deltas
   - Checks data quality (missingness, duplicates, uniqueness)

2. **Canonicalization** → `core/canonicalize.py`
   - Standardizes data format (date parsing, column detection)
   - Aggregates to brand-time level (sum sales/activities, average controls)
   - Detects `act_*`, `ctrl_*`, `spend_*` column patterns

3. **Feature Engineering** → `core/features.py`
   - Applies geometric adstock: `y[t] = x[t] + decay * y[t-1]`
   - Hill saturation (optional): `y = x^S / (K^S + x^S)`
   - Fourier seasonality (K harmonics)
   - Trend term (scaled time index)
   - Z-score standardization (saves scaler parameters)

4. **Bayesian Model Training** → `core/model_pymc.py`
   - Hierarchical Bayesian regression in log space
   - Uses PyMC with NUTS sampler
   - Saves posterior as ArviZ InferenceData (netcdf)

5. **Diagnostics** → `core/diagnostics.py`
   - Computes R-hat, ESS (bulk/tail), divergences, E-BFMI
   - Checks convergence (R-hat < 1.01, ESS > 400)

6. **Contributions & ROI** → `core/contributions.py`
   - Decomposes sales into baseline + channel contributions
   - Calculates ROI/ROAS per channel (if spend data available)

### Bayesian Model Specification

The model in `core/model_pymc.py` implements:

```
log(y + 1) ~ StudentT(nu, mu, sigma)
mu = intercept + X_channels @ beta + X_controls @ gamma
```

**Priors:**
- `intercept ~ Normal(0, 2)`
- `sigma_beta ~ HalfNormal(0.5)` - Hierarchical shrinkage
- `beta[c] ~ HalfNormal(sigma_beta)` - **Non-negative** channel effects
- `gamma[j] ~ Normal(0, 0.5)` - Control effects (can be negative)
- `sigma ~ HalfNormal(1.0)` - Observation noise
- `nu ~ Exponential(1/10)` - Degrees of freedom (robustness)

**Key Design Decisions:**
- Uses StudentT likelihood (robust to outliers vs Normal)
- Hierarchical shrinkage via `sigma_beta` (regularization across channels)
- Non-negative channel effects (marketing can't reduce sales)
- Log-space modeling (multiplicative effects, handles skewness)

### Run Lifecycle & Status Tracking

Runs progress through stages tracked in `core/status.py`:
- `CREATED` → `VALIDATED` → `FEATURES_BUILT` → `TRAINING` → `TRAINED` → `OUTPUTS_READY` → `ERROR`

Each stage writes JSON to `artifacts/runs/{run_id}/status.json`.

### Artifact Storage Structure

All data stored in `artifacts/` directory:

```
artifacts/
├── datasets/{dataset_id}/
│   ├── raw_data.parquet
│   └── validation_summary.json
│
└── runs/{run_id}/
    ├── run_spec.json              # Run configuration
    ├── status.json                # Current stage & progress
    ├── canonical_data.parquet     # Standardized data
    ├── column_info.json           # Column type mapping
    ├── features.parquet           # Engineered features
    ├── feature_metadata.json      # Feature config & names
    ├── feature_scaler.json        # Standardization params
    ├── posterior.nc               # ArviZ InferenceData (netcdf)
    ├── posterior_summary.json     # Parameter estimates
    ├── model_metadata.json        # Model configuration
    ├── diagnostics.json           # R-hat, ESS, divergences
    ├── contributions.parquet      # Time series decomposition
    ├── contribution_summary.json  # Aggregated contributions
    ├── roi_metrics.json           # ROI/ROAS by channel
    ├── fitted.parquet             # Actual vs predicted
    └── fit_metrics.json           # MAPE, RMSE, R²
```

### API Endpoint Organization

**Datasets** (`api/datasets.py`):
- `POST /datasets/upload` - Upload CSV dataset
- `GET /datasets/{dataset_id}` - Get dataset metadata
- `GET /datasets/{dataset_id}/raw` - Get raw data as JSON
- `GET /datasets/{dataset_id}/columns` - Get column type info
- `DELETE /datasets/{dataset_id}` - Delete dataset

**Runs** (`api/runs.py`):
- `POST /runs/create` - Create and start new MMM run (background task)
- `GET /runs/{run_id}/status` - Get run status
- `GET /runs/{run_id}/spec` - Get run specification
- `DELETE /runs/{run_id}` - Delete run

**Outputs** (`api/outputs.py`):
- `GET /outputs/{run_id}/posterior_summary` - Parameter estimates
- `GET /outputs/{run_id}/diagnostics` - Convergence diagnostics
- `GET /outputs/{run_id}/contributions` - Channel contributions
- `GET /outputs/{run_id}/roi` - ROI metrics by channel
- `GET /outputs/{run_id}/fitted` - Actual vs predicted
- `GET /outputs/{run_id}/summary` - Complete run summary

### Dataset Format Requirements

**Required columns:**
- `entity_id` (string) - Store/location/SKU identifier
- `period_start` (date) - Time period start (YYYY-MM-DD)
- `sales` (numeric) - Target variable

**Optional columns:**
- `act_*` - Marketing activity/driver columns (impressions, GRPs)
- `ctrl_*` - Control variables (price, weather, competitors)
- `spend_*` - Marketing spend columns (for ROI calculation)

See `sample_data/mmm_sample_small.csv` for complete example.

### Run Specification Format

Example JSON for creating a run:

```json
{
  "dataset_id": "my_dataset",
  "grain": "WEEK",
  "target_col": "sales",
  "drivers": ["act_tv", "act_digital", "act_radio"],
  "controls": ["ctrl_price_index"],
  "feature_config": {
    "adstock": {
      "decay_default": 0.5,
      "per_channel": {"act_tv": 0.7},
      "max_lag": 13
    },
    "saturation": {
      "enabled": true,
      "type": "hill",
      "K": 0.5,
      "S": 1.0
    },
    "seasonality": {"enabled": true, "K": 2},
    "trend": {"enabled": true}
  },
  "draws": 1000,
  "tune": 1000,
  "chains": 2,
  "target_accept": 0.9,
  "random_seed": 42
}
```

### CORS Configuration

Frontend integration points in `app.py`:
- Allows origins: `http://localhost:5173`, `http://localhost:3000` (Vite/React defaults)
- Full CORS enabled for development (credentials, all methods/headers)

### Background Task Execution

Run creation in `api/runs.py` uses FastAPI BackgroundTasks:
- Training runs asynchronously (NUTS sampling can take 5-30 minutes)
- Client polls `/runs/{run_id}/status` for completion
- Status updates written at each pipeline stage

### Error Handling Pattern

All pipeline stages follow consistent error handling:
```python
try:
    # Execute stage logic
    status.update(RunStage.NEXT_STAGE)
except Exception as e:
    status.set_error(str(e))
    raise
```

Errors stored in `status.json` with full traceback for debugging.

### Databricks Portability

The code is designed for portability to Databricks:
- Uses Parquet (Databricks native format)
- Deterministic with random seeds
- No hardcoded paths (configurable via environment)
- Modular core modules (can run as notebooks/jobs)
- Can replace local storage with DBFS/Delta Lake

## Common Development Tasks

### Running Sample End-to-End
```bash
# 1. Start server
python3 app.py

# 2. Upload dataset (from another terminal)
curl -X POST "http://localhost:8000/datasets/upload?dataset_id=test_data" \
  -F "file=@sample_data/mmm_sample_small.csv"

# 3. Create run
curl -X POST "http://localhost:8000/runs/create" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "test_data",
    "grain": "WEEK",
    "drivers": ["act_tv", "act_digital"],
    "controls": ["ctrl_price"],
    "draws": 500,
    "chains": 2
  }'

# 4. Check status (replace {run_id})
curl "http://localhost:8000/runs/{run_id}/status"

# 5. Get results
curl "http://localhost:8000/outputs/{run_id}/summary"
```

### Troubleshooting Model Convergence

**R-hat > 1.01 (poor convergence):**
- Increase `tune` parameter (e.g., 2000)
- Increase `target_accept` (e.g., 0.95)
- Check data quality issues

**Divergences:**
- Increase `target_accept` to 0.95 or 0.99
- Check for outliers in data

**Low ESS (< 400):**
- Increase `draws` (e.g., 2000)
- Increase `chains` (e.g., 4)

### PyMC Installation Issues

If installation fails:
```bash
# Use conda instead of pip
conda install -c conda-forge pymc arviz

# Or install from source
pip install --no-binary pymc pymc
```

## Performance Notes

**Typical sampling times (laptop CPU):**
- Fast config (500 draws, 2 chains): ~2-5 minutes
- Default config (1000 draws, 2 chains): ~5-10 minutes
- Production config (2000 draws, 4 chains): ~15-30 minutes

Speed depends on:
- Number of channels/controls
- Dataset size (time periods)
- Model complexity (adstock, saturation)
- Hardware (CPU cores for parallel chains)
