"""Outputs API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import pandas as pd

from core.storage import get_run_dir, load_json, load_parquet


router = APIRouter(prefix="/outputs", tags=["outputs"])


@router.get("/{run_id}/posterior_summary")
async def get_posterior_summary(run_id: str) -> Dict[str, Any]:
    """
    Get posterior parameter summary.

    Args:
        run_id: Run identifier

    Returns:
        Posterior summary with mean, SD, HDI for all parameters
    """
    run_dir = get_run_dir(run_id)
    summary_path = run_dir / "posterior_summary.json"

    if not summary_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Posterior summary not found for run {run_id}. Model may still be training."
        )

    return load_json(summary_path)


@router.get("/{run_id}/diagnostics")
async def get_diagnostics(run_id: str) -> Dict[str, Any]:
    """
    Get posterior diagnostics.

    Args:
        run_id: Run identifier

    Returns:
        Diagnostics including R-hat, ESS, divergences, E-BFMI
    """
    run_dir = get_run_dir(run_id)
    diagnostics_path = run_dir / "diagnostics.json"

    if not diagnostics_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Diagnostics not found for run {run_id}"
        )

    return load_json(diagnostics_path)


@router.get("/{run_id}/contributions")
async def get_contributions(
    run_id: str,
    format: str = "summary"
) -> Dict[str, Any]:
    """
    Get channel contributions.

    Args:
        run_id: Run identifier
        format: "summary" for aggregated metrics, "timeseries" for full time series

    Returns:
        Contribution data
    """
    run_dir = get_run_dir(run_id)

    if format == "summary":
        summary_path = run_dir / "contribution_summary.json"

        if not summary_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Contribution summary not found for run {run_id}"
            )

        return load_json(summary_path)

    elif format == "timeseries":
        contributions_path = run_dir / "contributions.parquet"

        if not contributions_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Contributions not found for run {run_id}"
            )

        df = load_parquet(contributions_path)

        return {
            "run_id": run_id,
            "n_periods": len(df),
            "columns": list(df.columns),
            "data": df.to_dict(orient="records")
        }

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format: {format}. Use 'summary' or 'timeseries'."
        )


@router.get("/{run_id}/roi")
async def get_roi_metrics(run_id: str) -> Dict[str, Any]:
    """
    Get ROI metrics by channel.

    Args:
        run_id: Run identifier

    Returns:
        ROI metrics (requires spend columns in dataset)
    """
    run_dir = get_run_dir(run_id)
    roi_path = run_dir / "roi_metrics.json"

    if not roi_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"ROI metrics not found for run {run_id}"
        )

    return load_json(roi_path)


@router.get("/{run_id}/fitted")
async def get_fitted_values(run_id: str) -> Dict[str, Any]:
    """
    Get fitted values (actual vs predicted).

    Args:
        run_id: Run identifier

    Returns:
        Time series of actual vs predicted values with fit metrics
    """
    run_dir = get_run_dir(run_id)

    fitted_path = run_dir / "fitted.parquet"
    metrics_path = run_dir / "fit_metrics.json"

    if not fitted_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Fitted values not found for run {run_id}"
        )

    df = load_parquet(fitted_path)
    fit_metrics = load_json(metrics_path) if metrics_path.exists() else {}

    return {
        "run_id": run_id,
        "fit_metrics": fit_metrics,
        "n_periods": len(df),
        "data": df.to_dict(orient="records")
    }


@router.get("/{run_id}/model_metadata")
async def get_model_metadata(run_id: str) -> Dict[str, Any]:
    """
    Get model metadata and configuration.

    Args:
        run_id: Run identifier

    Returns:
        Model metadata including channels, controls, sampling config
    """
    run_dir = get_run_dir(run_id)
    metadata_path = run_dir / "model_metadata.json"

    if not metadata_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model metadata not found for run {run_id}"
        )

    return load_json(metadata_path)


@router.get("/{run_id}/feature_metadata")
async def get_feature_metadata(run_id: str) -> Dict[str, Any]:
    """
    Get feature engineering metadata.

    Args:
        run_id: Run identifier

    Returns:
        Feature metadata including driver features, control features, etc.
    """
    run_dir = get_run_dir(run_id)
    metadata_path = run_dir / "feature_metadata.json"

    if not metadata_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Feature metadata not found for run {run_id}"
        )

    return load_json(metadata_path)


@router.get("/{run_id}/summary")
async def get_full_summary(run_id: str) -> Dict[str, Any]:
    """
    Get complete run summary combining all outputs.

    Args:
        run_id: Run identifier

    Returns:
        Comprehensive summary of all model outputs
    """
    run_dir = get_run_dir(run_id)

    # Check if run is complete
    from core.status import RunStatus
    status = RunStatus(run_id)

    if not status.is_complete():
        raise HTTPException(
            status_code=400,
            detail=f"Run {run_id} is not complete. Current stage: {status.get()['stage']}"
        )

    # Load all outputs
    summary = {
        "run_id": run_id,
        "model_metadata": load_json(run_dir / "model_metadata.json"),
        "fit_metrics": load_json(run_dir / "fit_metrics.json"),
        "diagnostics": load_json(run_dir / "diagnostics.json"),
        "contribution_summary": load_json(run_dir / "contribution_summary.json"),
        "posterior_summary": load_json(run_dir / "posterior_summary.json")
    }

    # Add ROI if available
    roi_path = run_dir / "roi_metrics.json"
    if roi_path.exists():
        summary["roi_metrics"] = load_json(roi_path)

    return summary


@router.get("/{run_id}/features")
async def get_features(
    run_id: str,
    limit: int | None = None
) -> Dict[str, Any]:
    """
    Get engineered features.

    Args:
        run_id: Run identifier
        limit: Optional row limit

    Returns:
        Features DataFrame as JSON
    """
    run_dir = get_run_dir(run_id)
    features_path = run_dir / "features.parquet"

    if not features_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Features not found for run {run_id}"
        )

    df = load_parquet(features_path)

    if limit:
        df = df.head(limit)

    return {
        "run_id": run_id,
        "n_periods": len(df),
        "columns": list(df.columns),
        "data": df.to_dict(orient="records")
    }


@router.get("/{run_id}/canonical")
async def get_canonical_data(
    run_id: str,
    limit: int | None = None
) -> Dict[str, Any]:
    """
    Get canonicalized dataset.

    Args:
        run_id: Run identifier
        limit: Optional row limit

    Returns:
        Canonical data as JSON
    """
    run_dir = get_run_dir(run_id)
    canonical_path = run_dir / "canonical_data.parquet"

    if not canonical_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Canonical data not found for run {run_id}"
        )

    df = load_parquet(canonical_path)

    if limit:
        df = df.head(limit)

    return {
        "run_id": run_id,
        "n_periods": len(df),
        "columns": list(df.columns),
        "data": df.to_dict(orient="records")
    }
