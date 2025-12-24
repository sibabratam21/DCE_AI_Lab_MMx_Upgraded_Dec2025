"""Feature engineering for MMM."""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
from .storage import get_run_dir, load_parquet, save_parquet, save_json, load_json


def apply_adstock(
    x: np.ndarray,
    decay: float,
    max_lag: int = 13
) -> np.ndarray:
    """
    Apply geometric adstock transformation.

    y[t] = x[t] + decay * y[t-1]

    Args:
        x: Input series
        decay: Decay parameter (0-1)
        max_lag: Maximum lag periods (for numerical stability)

    Returns:
        Adstocked series
    """
    y = np.zeros_like(x)
    y[0] = x[0]

    for t in range(1, len(x)):
        y[t] = x[t] + decay * y[t-1]

    return y


def apply_hill_saturation(
    x: np.ndarray,
    K: float = 0.5,
    S: float = 1.0
) -> np.ndarray:
    """
    Apply Hill saturation transformation.

    y = x^S / (K^S + x^S)

    Args:
        x: Input series (must be non-negative)
        K: Half-saturation point
        S: Shape parameter

    Returns:
        Saturated series
    """
    # Ensure non-negative
    x = np.maximum(x, 0)

    # Avoid division by zero
    denominator = K**S + x**S
    denominator = np.where(denominator == 0, 1e-10, denominator)

    return (x**S) / denominator


def create_fourier_features(
    n: int,
    period: int,
    K: int = 2
) -> np.ndarray:
    """
    Create Fourier seasonality features.

    Args:
        n: Number of time periods
        period: Periodicity (52 for weekly, 12 for monthly)
        K: Number of harmonics

    Returns:
        Array of shape (n, 2*K) with sin/cos features
    """
    t = np.arange(n)
    features = []

    for k in range(1, K + 1):
        features.append(np.sin(2 * np.pi * k * t / period))
        features.append(np.cos(2 * np.pi * k * t / period))

    return np.column_stack(features)


def build_features(
    run_id: str,
    run_spec: Dict[str, Any]
) -> pd.DataFrame:
    """
    Build features for MMM model.

    Steps:
    1. Load canonical data
    2. Apply time window filter
    3. Apply adstock to drivers
    4. Apply saturation (if enabled)
    5. Create seasonality features
    6. Create trend feature
    7. Standardize (z-score)
    8. Save features and scaler params

    Args:
        run_id: Run identifier
        run_spec: Run specification

    Returns:
        Features DataFrame
    """
    run_dir = get_run_dir(run_id)

    # Load canonical data
    canonical = load_parquet(run_dir / "canonical_data.parquet")

    # Extract config
    grain = run_spec.get("grain", "WEEK")
    target_col = run_spec.get("target_col", "sales")
    drivers = run_spec.get("drivers", [])
    controls = run_spec.get("controls", [])

    feature_config = run_spec.get("feature_config", {})
    adstock_config = feature_config.get("adstock", {})
    saturation_config = feature_config.get("saturation", {})
    seasonality_config = feature_config.get("seasonality", {})
    trend_config = feature_config.get("trend", {})

    windows = run_spec.get("windows", {})
    carryover_months = windows.get("carryover_months", 12)
    estimation_months = windows.get("estimation_months", 12)

    # Time window filtering
    total_months_needed = carryover_months + estimation_months
    min_periods_needed = int(total_months_needed * (52/12 if grain == "WEEK" else 1))

    if len(canonical) > min_periods_needed:
        # Take last N periods
        canonical = canonical.tail(min_periods_needed).reset_index(drop=True)

    # Initialize features DataFrame
    features = pd.DataFrame()
    features["period_start"] = canonical["period_start"]

    # Target variable (log transform)
    y = canonical[target_col].values
    y_log = np.log(y + 1)  # log(sales + 1) to handle zeros
    features["y"] = y
    features["y_log"] = y_log

    # Apply adstock to drivers
    decay_default = adstock_config.get("decay_default", 0.5)
    per_channel_decay = adstock_config.get("per_channel", {})
    max_lag = adstock_config.get("max_lag", 13)

    adstocked_drivers = []
    for driver in drivers:
        if driver not in canonical.columns:
            continue

        x = canonical[driver].values
        decay = per_channel_decay.get(driver, decay_default)

        x_adstocked = apply_adstock(x, decay, max_lag)

        # Apply saturation if enabled
        if saturation_config.get("enabled", False):
            sat_type = saturation_config.get("type", "hill")
            if sat_type == "hill":
                K = saturation_config.get("K", 0.5)
                S = saturation_config.get("S", 1.0)
                x_adstocked = apply_hill_saturation(x_adstocked, K, S)

        col_name = f"X_{driver}"
        features[col_name] = x_adstocked
        adstocked_drivers.append(col_name)

    # Add controls (no transformation)
    control_cols = []
    for ctrl in controls:
        if ctrl in canonical.columns:
            col_name = f"X_{ctrl}"
            features[col_name] = canonical[ctrl].values
            control_cols.append(col_name)

    # Seasonality features
    if seasonality_config.get("enabled", True):
        K = seasonality_config.get("K", 2)
        period = 52 if grain == "WEEK" else 12
        fourier = create_fourier_features(len(features), period, K)

        for i in range(fourier.shape[1]):
            features[f"seasonality_{i}"] = fourier[:, i]

    # Trend feature
    if trend_config.get("enabled", True):
        trend = np.arange(len(features))
        trend_scaled = (trend - trend.mean()) / (trend.std() + 1e-10)
        features["trend"] = trend_scaled

    # Standardize features (z-score)
    # Keep y and y_log unstandardized
    # Standardize all X_ columns

    feature_columns = [col for col in features.columns if col.startswith("X_")]
    scaler_params = {}

    for col in feature_columns:
        mean_val = features[col].mean()
        std_val = features[col].std()

        # Avoid division by zero
        if std_val < 1e-10:
            std_val = 1.0

        features[col] = (features[col] - mean_val) / std_val

        scaler_params[col] = {
            "mean": float(mean_val),
            "std": float(std_val)
        }

    # Save features
    save_parquet(features, run_dir / "features.parquet")

    # Save scaler params
    save_json(scaler_params, run_dir / "feature_scaler.json")

    # Save feature metadata
    feature_metadata = {
        "n_periods": len(features),
        "driver_features": adstocked_drivers,
        "control_features": control_cols,
        "seasonality_features": [col for col in features.columns if col.startswith("seasonality_")],
        "trend_features": ["trend"] if "trend" in features.columns else [],
        "target": "y_log"
    }

    save_json(feature_metadata, run_dir / "feature_metadata.json")

    return features
