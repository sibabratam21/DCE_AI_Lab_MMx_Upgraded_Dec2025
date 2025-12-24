# Bayesian MMM Backend

Local backend for Marketing Mix Modeling using PyMC, exposed via FastAPI.

## Overview

This backend implements a complete Bayesian Marketing Mix Modeling pipeline:

1. **Dataset Upload & Validation** - CSV upload with structure validation
2. **Canonicalization** - Standardize and aggregate to brand-time level
3. **Feature Engineering** - Apply adstock, saturation, seasonality, trend
4. **Bayesian MMM** - Train hierarchical model using PyMC with NUTS sampler
5. **Diagnostics** - Compute R-hat, ESS, divergences, E-BFMI
6. **Contributions** - Decompose sales into baseline + channel contributions
7. **ROI Metrics** - Calculate ROI/ROAS per channel (if spend data available)

## Tech Stack

- **FastAPI** - REST API framework
- **PyMC 5.10+** - Bayesian probabilistic programming
- **ArviZ** - Posterior analysis and diagnostics
- **Pandas/Polars** - Data manipulation
- **PyArrow** - Parquet file format
- **NumPy/SciPy** - Numerical computing

## Installation

### Prerequisites

- Python 3.10 or higher
- pip or conda

### Setup

```bash
cd backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the Backend

```bash
# From backend directory
python3 app.py

# Or with uvicorn directly
uvicorn app:app --reload --port 8000
```

The API will be available at: `http://localhost:8000`

- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Datasets

- `POST /datasets/upload` - Upload CSV dataset
- `GET /datasets/{dataset_id}` - Get dataset metadata
- `GET /datasets/{dataset_id}/raw` - Get raw data as JSON
- `GET /datasets/{dataset_id}/columns` - Get column type info
- `DELETE /datasets/{dataset_id}` - Delete dataset
- `GET /datasets/` - List all datasets

### Runs

- `POST /runs/create` - Create and start new MMM run
- `GET /runs/{run_id}/status` - Get run status
- `GET /runs/{run_id}/spec` - Get run specification
- `DELETE /runs/{run_id}` - Delete run
- `GET /runs/` - List all runs

### Outputs

- `GET /outputs/{run_id}/posterior_summary` - Parameter estimates
- `GET /outputs/{run_id}/diagnostics` - R-hat, ESS, divergences
- `GET /outputs/{run_id}/contributions` - Channel contributions (summary or timeseries)
- `GET /outputs/{run_id}/roi` - ROI metrics by channel
- `GET /outputs/{run_id}/fitted` - Actual vs predicted values
- `GET /outputs/{run_id}/model_metadata` - Model configuration
- `GET /outputs/{run_id}/summary` - Complete run summary
- `GET /outputs/{run_id}/features` - Engineered features
- `GET /outputs/{run_id}/canonical` - Canonicalized data

## Dataset Format

### Required Columns

- `entity_id` (string) - Store/location/SKU identifier
- `period_start` (date) - Time period start date (YYYY-MM-DD)
- `sales` (numeric) - Target variable

### Optional Columns

- `act_*` - Marketing activity/driver columns (impressions, clicks, GRPs)
- `ctrl_*` - Control variables (price, weather, competitors)
- `spend_*` - Marketing spend columns (for ROI calculation)

### Example

```csv
entity_id,period_start,sales,act_tv,act_digital,spend_tv,spend_digital,ctrl_price_index
store_001,2022-01-03,1250.50,250000,180000,5000,3000,100.2
store_001,2022-01-10,1320.75,260000,185000,5200,3100,99.8
store_002,2022-01-03,980.30,220000,160000,4400,2700,101.0
...
```

See `sample_data/mmm_sample_small.csv` for a complete example.

## Model Specification

### Bayesian MMM

The model uses a hierarchical Bayesian regression in log space:

```
log(y + 1) ~ StudentT(nu, mu, sigma)
mu = intercept + X_channels @ beta + X_controls @ gamma
```

### Priors

- `intercept ~ Normal(0, 2)`
- `sigma_beta ~ HalfNormal(0.5)` - Hierarchical shrinkage
- `beta[c] ~ HalfNormal(sigma_beta)` - **Non-negative** channel effects
- `gamma[j] ~ Normal(0, 0.5)` - Control effects (can be negative)
- `sigma ~ HalfNormal(1.0)` - Observation noise
- `nu ~ Exponential(1/10)` - Degrees of freedom (robustness to outliers)

### Feature Engineering

**Adstock (Geometric)**:
```
y[t] = x[t] + decay * y[t-1]
```

**Hill Saturation**:
```
y = x^S / (K^S + x^S)
```

**Fourier Seasonality**:
```
sin(2π k t / period), cos(2π k t / period) for k=1..K
```

**Trend**:
```
Scaled time index: (t - mean(t)) / std(t)
```

## Run Specification

Example run spec for creating a new MMM run:

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
      "per_channel": {
        "act_tv": 0.7,
        "act_digital": 0.3
      },
      "max_lag": 13
    },
    "saturation": {
      "enabled": true,
      "type": "hill",
      "K": 0.5,
      "S": 1.0
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
  "draws": 1000,
  "tune": 1000,
  "chains": 2,
  "target_accept": 0.9,
  "random_seed": 42
}
```

## File Structure

```
backend/
├── app.py                 # FastAPI application
├── requirements.txt       # Python dependencies
├── README.md             # This file
│
├── core/                 # Core MMM modules
│   ├── storage.py        # File system utilities
│   ├── status.py         # Run status tracking
│   ├── validation.py     # Dataset validation
│   ├── canonicalize.py   # Data standardization
│   ├── features.py       # Feature engineering
│   ├── model_pymc.py     # PyMC Bayesian MMM
│   ├── diagnostics.py    # Posterior diagnostics
│   └── contributions.py  # Channel contributions & ROI
│
├── api/                  # API endpoints
│   ├── datasets.py       # Dataset upload & management
│   ├── runs.py           # Run creation & monitoring
│   └── outputs.py        # Model outputs & results
│
├── sample_data/          # Sample datasets
│   ├── generate_sample.py
│   └── mmm_sample_small.csv
│
└── artifacts/            # Generated at runtime
    ├── datasets/         # Uploaded datasets
    └── runs/             # Model runs and outputs
```

## Artifacts Directory

All data is stored in `artifacts/`:

### Dataset Directory (`artifacts/datasets/{dataset_id}/`)
- `raw_data.parquet` - Original uploaded data
- `validation_summary.json` - Validation results

### Run Directory (`artifacts/runs/{run_id}/`)
- `run_spec.json` - Run configuration
- `status.json` - Current run status
- `canonical_data.parquet` - Standardized data
- `column_info.json` - Column type mapping
- `features.parquet` - Engineered features
- `feature_metadata.json` - Feature configuration
- `feature_scaler.json` - Standardization parameters
- `posterior.nc` - ArviZ InferenceData (netcdf)
- `posterior_summary.json` - Parameter estimates
- `model_metadata.json` - Model configuration
- `diagnostics.json` - Convergence diagnostics
- `contributions.parquet` - Time series decomposition
- `contribution_summary.json` - Aggregated contributions
- `roi_metrics.json` - ROI/ROAS by channel
- `fitted.parquet` - Actual vs predicted
- `fit_metrics.json` - MAPE, RMSE, R²

## Example Usage

### 1. Upload Dataset

```bash
curl -X POST "http://localhost:8000/datasets/upload?dataset_id=my_data" \
  -F "file=@sample_data/mmm_sample_small.csv"
```

### 2. Create Run

```bash
curl -X POST "http://localhost:8000/runs/create" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "my_data",
    "grain": "WEEK",
    "drivers": ["act_tv", "act_digital", "act_radio"],
    "controls": ["ctrl_price_index"],
    "draws": 500,
    "chains": 2
  }'
```

### 3. Check Status

```bash
curl "http://localhost:8000/runs/{run_id}/status"
```

### 4. Get Results

```bash
# Posterior summary
curl "http://localhost:8000/outputs/{run_id}/posterior_summary"

# Diagnostics
curl "http://localhost:8000/outputs/{run_id}/diagnostics"

# Channel contributions
curl "http://localhost:8000/outputs/{run_id}/contributions?format=summary"

# ROI metrics
curl "http://localhost:8000/outputs/{run_id}/roi"

# Complete summary
curl "http://localhost:8000/outputs/{run_id}/summary"
```

## Diagnostics

The diagnostics module computes:

- **R-hat** - Convergence diagnostic (should be < 1.01)
- **ESS (bulk)** - Effective sample size for mean estimates (> 400 recommended)
- **ESS (tail)** - Effective sample size for tail quantiles (> 400 recommended)
- **Divergences** - Number of divergent transitions (should be 0)
- **E-BFMI** - Energy Bayesian Fraction of Missing Information (> 0.2)
- **Max tree depth** - Percentage hitting max tree depth (< 1%)

## Portability to Databricks

The code is designed to be portable to Databricks:

- Uses Parquet for data storage (Databricks native format)
- Deterministic with random seeds
- No hardcoded paths (configurable via environment)
- Modular design (core modules can run independently)
- Can be converted to Databricks notebooks or jobs

### To Deploy on Databricks:

1. Create a Databricks cluster with PyMC dependencies
2. Convert `core/` modules to notebooks or wheel package
3. Use Databricks MLflow for tracking runs
4. Replace local file storage with DBFS or Delta Lake
5. Use Databricks Jobs for background processing

## Performance Notes

- **Default config** (1000 draws, 2 chains): ~5-10 minutes on laptop CPU
- **Fast config** (500 draws, 2 chains): ~2-5 minutes
- **Production config** (2000 draws, 4 chains): ~15-30 minutes

Sampling speed depends on:
- Number of channels/controls
- Dataset size (number of time periods)
- Model complexity (adstock, saturation)
- Hardware (CPU cores for parallel chains)

## Troubleshooting

### Convergence Issues (R-hat > 1.01)

- Increase `tune` (e.g., 2000)
- Increase `target_accept` (e.g., 0.95)
- Check for data quality issues
- Reduce model complexity

### Divergences

- Increase `target_accept` to 0.95 or 0.99
- Reparameterize model (adjust priors)
- Check for outliers in data

### Low ESS

- Increase `draws` (e.g., 2000)
- Increase `chains` (e.g., 4)
- Improve model specification

### Installation Issues

If PyMC installation fails:
```bash
# Use conda instead of pip
conda install -c conda-forge pymc arviz

# Or install from source
pip install --no-binary pymc pymc
```

## Future Enhancements

Potential additions (not in v1):

- [ ] Budget optimization endpoints
- [ ] Scenario planning
- [ ] Uncertainty intervals on contributions
- [ ] Posterior predictive checks
- [ ] Model comparison (WAIC, LOO)
- [ ] Hierarchical models (multi-geo, multi-product)
- [ ] Custom priors per channel
- [ ] Advanced saturation curves (Michaelis-Menten, exponential)
- [ ] Distributed sampling for large datasets

## License

Internal use only.
