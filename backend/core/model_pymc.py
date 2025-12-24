"""PyMC Bayesian MMM implementation."""
import pymc as pm
import arviz as az
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from .storage import get_run_dir, load_parquet, load_json, save_json


def train_bayesian_mmm(
    run_id: str,
    run_spec: Dict[str, Any],
    draws: int = 1000,
    tune: int = 1000,
    chains: int = 2,
    target_accept: float = 0.9
) -> None:
    """
    Train Bayesian MMM using PyMC.

    Model specification:
        log(y + 1) ~ StudentT(nu, mu, sigma)
        mu = intercept + X_channels @ beta + X_controls @ gamma

    Priors:
        intercept ~ Normal(0, 2)
        sigma_beta ~ HalfNormal(0.5)  # hierarchical shrinkage
        beta[c] ~ HalfNormal(sigma_beta)  # non-negative channel effects
        gamma[j] ~ Normal(0, 0.5)  # controls can be positive or negative
        sigma ~ HalfNormal(1.0)  # observation noise
        nu ~ Exponential(1/10)  # degrees of freedom for StudentT

    Args:
        run_id: Run identifier
        run_spec: Run specification with random_seed
        draws: Number of posterior draws
        tune: Number of tuning steps
        chains: Number of MCMC chains
        target_accept: Target acceptance rate

    Outputs:
        - posterior.nc (ArviZ InferenceData netcdf)
        - posterior_summary.json
    """
    run_dir = get_run_dir(run_id)

    # Load features
    features = load_parquet(run_dir / "features.parquet")
    feature_metadata = load_json(run_dir / "feature_metadata.json")

    # Extract feature matrices
    driver_features = feature_metadata["driver_features"]
    control_features = feature_metadata["control_features"]
    seasonality_features = feature_metadata["seasonality_features"]
    trend_features = feature_metadata["trend_features"]

    # Combine control features (controls + seasonality + trend)
    all_control_features = control_features + seasonality_features + trend_features

    # Build matrices
    y = features["y_log"].values  # log-transformed target
    X_channels = features[driver_features].values if driver_features else np.zeros((len(features), 0))
    X_controls = features[all_control_features].values if all_control_features else np.zeros((len(features), 0))

    n_channels = X_channels.shape[1]
    n_controls = X_controls.shape[1]

    # Set random seed
    random_seed = run_spec.get("random_seed", 42)
    rng = np.random.default_rng(random_seed)

    # Build PyMC model
    with pm.Model() as model:
        # Priors for intercept
        intercept = pm.Normal("intercept", mu=0, sigma=2)

        # Hierarchical prior for channel coefficients
        if n_channels > 0:
            sigma_beta = pm.HalfNormal("sigma_beta", sigma=0.5)
            beta = pm.HalfNormal("beta", sigma=sigma_beta, shape=n_channels)
        else:
            beta = np.array([])

        # Priors for control coefficients
        if n_controls > 0:
            gamma = pm.Normal("gamma", mu=0, sigma=0.5, shape=n_controls)
        else:
            gamma = np.array([])

        # Observation noise
        sigma = pm.HalfNormal("sigma", sigma=1.0)

        # Degrees of freedom for StudentT
        nu = pm.Exponential("nu", lam=1/10)

        # Linear predictor
        mu = intercept
        if n_channels > 0:
            mu = mu + pm.math.dot(X_channels, beta)
        if n_controls > 0:
            mu = mu + pm.math.dot(X_controls, gamma)

        # Likelihood
        y_obs = pm.StudentT("y_obs", nu=nu, mu=mu, sigma=sigma, observed=y)

        # Sample posterior
        trace = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            target_accept=target_accept,
            random_seed=rng,
            return_inferencedata=True,
            progressbar=True
        )

    # Save posterior as netcdf
    trace.to_netcdf(str(run_dir / "posterior.nc"))

    # Compute posterior summary
    summary = az.summary(
        trace,
        var_names=["intercept", "beta", "gamma", "sigma", "nu", "sigma_beta"],
        hdi_prob=0.94
    )

    # Convert to dict format
    posterior_summary = {
        "parameters": {}
    }

    for param_name in summary.index:
        posterior_summary["parameters"][param_name] = {
            "mean": float(summary.loc[param_name, "mean"]),
            "sd": float(summary.loc[param_name, "sd"]),
            "hdi_3%": float(summary.loc[param_name, "hdi_3%"]),
            "hdi_97%": float(summary.loc[param_name, "hdi_97%"]),
            "r_hat": float(summary.loc[param_name, "r_hat"]) if "r_hat" in summary.columns else None,
            "ess_bulk": float(summary.loc[param_name, "ess_bulk"]) if "ess_bulk" in summary.columns else None,
            "ess_tail": float(summary.loc[param_name, "ess_tail"]) if "ess_tail" in summary.columns else None
        }

    # Add channel-specific summaries
    if n_channels > 0:
        channel_summaries = {}
        for i, channel_name in enumerate(driver_features):
            beta_param = f"beta[{i}]"
            if beta_param in posterior_summary["parameters"]:
                channel_summaries[channel_name] = posterior_summary["parameters"][beta_param]

        posterior_summary["channel_effects"] = channel_summaries

    save_json(posterior_summary, run_dir / "posterior_summary.json")

    # Store model metadata
    model_metadata = {
        "n_channels": n_channels,
        "n_controls": n_controls,
        "n_observations": len(y),
        "channel_names": driver_features,
        "control_names": all_control_features,
        "draws": draws,
        "tune": tune,
        "chains": chains,
        "target_accept": target_accept,
        "random_seed": random_seed
    }

    save_json(model_metadata, run_dir / "model_metadata.json")
