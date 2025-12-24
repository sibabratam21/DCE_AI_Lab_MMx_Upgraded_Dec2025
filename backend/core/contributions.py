"""Compute channel contributions and decomposition."""
import arviz as az
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from .storage import get_run_dir, load_parquet, load_json, save_parquet, save_json


def compute_contributions(run_id: str) -> pd.DataFrame:
    """
    Compute channel-level contributions to sales.

    This function decomposes predictions into:
    - Baseline (intercept + controls + seasonality + trend)
    - Per-channel contributions (X_channel[t] * beta[c])

    Uses posterior mean for coefficients.

    Args:
        run_id: Run identifier

    Returns:
        DataFrame with contributions per time period

    Outputs:
        - contributions.parquet
        - contribution_summary.json
    """
    run_dir = get_run_dir(run_id)

    # Load posterior
    trace = az.from_netcdf(str(run_dir / "posterior.nc"))

    # Load features
    features = load_parquet(run_dir / "features.parquet")
    feature_metadata = load_json(run_dir / "feature_metadata.json")
    model_metadata = load_json(run_dir / "model_metadata.json")

    # Extract posterior means
    intercept_mean = float(trace.posterior["intercept"].mean().values)

    # Channel coefficients
    channel_names = model_metadata["channel_names"]
    n_channels = model_metadata["n_channels"]

    if n_channels > 0:
        beta_mean = trace.posterior["beta"].mean(dim=["chain", "draw"]).values
    else:
        beta_mean = np.array([])

    # Control coefficients
    control_names = model_metadata["control_names"]
    n_controls = model_metadata["n_controls"]

    if n_controls > 0:
        gamma_mean = trace.posterior["gamma"].mean(dim=["chain", "draw"]).values
    else:
        gamma_mean = np.array([])

    # Build contributions DataFrame
    contributions = pd.DataFrame()
    contributions["period_start"] = features["period_start"]

    # Actual sales (original scale, not log)
    contributions["y_actual"] = features["y"]

    # Intercept contribution (in log space, then exp)
    intercept_contrib = np.exp(intercept_mean) - 1
    contributions["baseline_intercept"] = intercept_contrib

    # Control contributions
    total_control_contrib = np.zeros(len(features))

    for i, ctrl_name in enumerate(control_names):
        # Control column in features (already standardized)
        X_ctrl = features[ctrl_name].values

        # Contribution in log space
        contrib_log = gamma_mean[i] * X_ctrl

        # Convert to original scale: exp(contrib_log) - 1
        # But we need to be careful here. The contribution is additive in log space,
        # so we compute the marginal effect properly.
        # For simplicity in v1, we'll report contributions in log space
        # and convert to % of total later.
        total_control_contrib += contrib_log

    # Convert total control contribution to sales units
    # We'll use: sales_contrib = exp(intercept + control_contrib) - exp(intercept)
    control_sales_contrib = np.exp(intercept_mean + total_control_contrib) - np.exp(intercept_mean)
    contributions["baseline_controls"] = control_sales_contrib

    # Seasonality and trend are part of controls, already included above

    # Channel contributions
    for i, channel_name in enumerate(channel_names):
        # Feature column (already standardized)
        feat_col = f"X_{channel_name}"
        X_channel = features[feat_col].values

        # Contribution in log space
        contrib_log = beta_mean[i] * X_channel

        # Convert to sales units (marginal contribution)
        # For a given channel, the marginal contribution is:
        # sales_with_channel - sales_without_channel
        # = exp(mu) - exp(mu - beta*X)
        # ≈ exp(mu) * (exp(beta*X) - 1) for small beta*X
        # But more accurately, we compute it as:
        # exp(intercept + controls + beta*X) - exp(intercept + controls)

        # Build baseline (without this channel)
        baseline_log = intercept_mean + total_control_contrib

        # Contribution to sales
        channel_sales_contrib = np.exp(baseline_log + contrib_log) - np.exp(baseline_log)

        contributions[f"channel_{channel_name}"] = channel_sales_contrib

    # Total predicted sales (in log space, then exp)
    y_log_pred = intercept_mean + total_control_contrib
    for i in range(n_channels):
        feat_col = f"X_{channel_names[i]}"
        X_channel = features[feat_col].values
        y_log_pred += beta_mean[i] * X_channel

    contributions["y_predicted"] = np.exp(y_log_pred) - 1

    # Residuals
    contributions["residual"] = contributions["y_actual"] - contributions["y_predicted"]

    # Save contributions
    save_parquet(contributions, run_dir / "contributions.parquet")

    # Compute summary statistics
    summary = compute_contribution_summary(contributions, channel_names)
    save_json(summary, run_dir / "contribution_summary.json")

    return contributions


def compute_contribution_summary(
    contributions: pd.DataFrame,
    channel_names: list
) -> Dict[str, Any]:
    """
    Compute summary statistics for contributions.

    Args:
        contributions: Contributions DataFrame
        channel_names: List of channel names

    Returns:
        Summary dictionary with aggregated metrics
    """
    summary = {
        "total_actual_sales": float(contributions["y_actual"].sum()),
        "total_predicted_sales": float(contributions["y_predicted"].sum()),
        "mape": None,
        "baseline": {},
        "channels": {}
    }

    # MAPE
    mape = np.mean(np.abs(contributions["residual"]) / (contributions["y_actual"] + 1e-10)) * 100
    summary["mape"] = float(mape)

    # Baseline contributions
    baseline_intercept_total = float(contributions["baseline_intercept"].sum())
    baseline_controls_total = float(contributions["baseline_controls"].sum())
    baseline_total = baseline_intercept_total + baseline_controls_total

    summary["baseline"] = {
        "intercept_total": baseline_intercept_total,
        "controls_total": baseline_controls_total,
        "total": baseline_total,
        "percent_of_sales": (baseline_total / summary["total_actual_sales"]) * 100 if summary["total_actual_sales"] > 0 else 0
    }

    # Channel contributions
    for channel_name in channel_names:
        col_name = f"channel_{channel_name}"
        if col_name in contributions.columns:
            channel_total = float(contributions[col_name].sum())
            channel_mean = float(contributions[col_name].mean())

            summary["channels"][channel_name] = {
                "total_contribution": channel_total,
                "mean_contribution": channel_mean,
                "percent_of_sales": (channel_total / summary["total_actual_sales"]) * 100 if summary["total_actual_sales"] > 0 else 0
            }

    return summary


def compute_roi_metrics(run_id: str) -> Dict[str, Any]:
    """
    Compute ROI metrics by channel.

    Requires spend columns (spend_*) to be present in canonical data.

    ROI = total_contribution / total_spend

    Args:
        run_id: Run identifier

    Returns:
        ROI metrics dictionary

    Outputs:
        - roi_metrics.json
    """
    run_dir = get_run_dir(run_id)

    # Load contributions
    contributions = load_parquet(run_dir / "contributions.parquet")

    # Load canonical data to get spend
    canonical = load_parquet(run_dir / "canonical_data.parquet")

    # Load column info to get spend mapping
    column_info = load_json(run_dir / "column_info.json")
    spend_cols = column_info.get("spend", [])

    if not spend_cols:
        # No spend data available
        roi_metrics = {
            "error": "No spend columns found in dataset. ROI calculation requires spend_* columns.",
            "channels": {}
        }
        save_json(roi_metrics, run_dir / "roi_metrics.json")
        return roi_metrics

    # Map activity columns to spend columns
    # Assume naming convention: act_channel_name -> spend_channel_name
    roi_metrics = {
        "channels": {}
    }

    model_metadata = load_json(run_dir / "model_metadata.json")
    channel_names = model_metadata["channel_names"]

    for channel_name in channel_names:
        # Try to find corresponding spend column
        # channel_name is like "act_display" -> spend column is "spend_display"
        spend_col_name = channel_name.replace("act_", "spend_")

        if spend_col_name not in canonical.columns:
            # Try without prefix (e.g., if channel_name is already "display")
            spend_col_name = f"spend_{channel_name}"

        if spend_col_name in canonical.columns:
            total_spend = float(canonical[spend_col_name].sum())

            # Get contribution from contributions DataFrame
            contrib_col = f"channel_{channel_name}"
            if contrib_col in contributions.columns:
                total_contribution = float(contributions[contrib_col].sum())

                roi = total_contribution / total_spend if total_spend > 0 else 0

                roi_metrics["channels"][channel_name] = {
                    "total_spend": total_spend,
                    "total_contribution": total_contribution,
                    "roi": roi,
                    "roas": roi,  # ROI and ROAS are same here (revenue / spend)
                    "efficiency": f"${total_contribution / total_spend:.2f}" if total_spend > 0 else "N/A"
                }
            else:
                roi_metrics["channels"][channel_name] = {
                    "error": f"No contribution data found for {channel_name}"
                }
        else:
            roi_metrics["channels"][channel_name] = {
                "error": f"No spend column found for {channel_name}. Expected {spend_col_name}."
            }

    save_json(roi_metrics, run_dir / "roi_metrics.json")

    return roi_metrics


def compute_fitted_values(run_id: str) -> pd.DataFrame:
    """
    Compute fitted values for each time period.

    This is a time series of actual vs predicted values,
    useful for plotting model fit.

    Args:
        run_id: Run identifier

    Returns:
        DataFrame with period_start, y_actual, y_predicted

    Outputs:
        - fitted.parquet
    """
    run_dir = get_run_dir(run_id)

    # Load contributions (which already has y_actual and y_predicted)
    contributions = load_parquet(run_dir / "contributions.parquet")

    fitted = pd.DataFrame()
    fitted["period_start"] = contributions["period_start"]
    fitted["y_actual"] = contributions["y_actual"]
    fitted["y_predicted"] = contributions["y_predicted"]
    fitted["residual"] = contributions["residual"]

    # Compute fit metrics
    mape = np.mean(np.abs(fitted["residual"]) / (fitted["y_actual"] + 1e-10)) * 100
    rmse = np.sqrt(np.mean(fitted["residual"] ** 2))
    r2 = 1 - (np.sum(fitted["residual"] ** 2) / np.sum((fitted["y_actual"] - fitted["y_actual"].mean()) ** 2))

    fit_metrics = {
        "mape": float(mape),
        "rmse": float(rmse),
        "r2": float(r2)
    }

    save_json(fit_metrics, run_dir / "fit_metrics.json")
    save_parquet(fitted, run_dir / "fitted.parquet")

    return fitted
