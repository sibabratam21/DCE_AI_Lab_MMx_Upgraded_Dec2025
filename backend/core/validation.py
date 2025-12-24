"""Dataset validation for MMM."""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Any
from .storage import get_dataset_dir, save_json


def detect_grain(df: pd.DataFrame, date_col: str = "period_start") -> str:
    """Detect time grain from period deltas."""
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)

    deltas = df[date_col].diff().dropna()
    median_delta = deltas.median()

    # Convert to days
    median_days = median_delta.days

    if 6 <= median_days <= 8:
        return "WEEK"
    elif 28 <= median_days <= 31:
        return "MONTH"
    elif median_days == 1:
        return "DAY"
    else:
        return f"CUSTOM_{median_days}D"


def validate_dataset(dataset_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate dataset structure and quality.

    Required columns:
    - entity_id (string)
    - period_start (date)
    - sales (numeric)

    Optional columns:
    - act_* (activity/driver columns)
    - ctrl_* (control variables)
    - spend_* (spend columns for ROI calculation)

    Returns validation_summary dict.
    """
    dataset_dir = get_dataset_dir(dataset_id)
    validation_summary = {
        "dataset_id": dataset_id,
        "row_count": len(df),
        "column_count": len(df.columns),
        "errors": [],
        "warnings": [],
        "column_types": {},
        "missingness": {},
        "grain": None,
        "time_coverage_months": None,
        "entity_count": None
    }

    # Check required columns
    required_cols = ["entity_id", "period_start", "sales"]
    missing_cols = [col for col in required_cols if col not in df.columns]

    if missing_cols:
        validation_summary["errors"].append(
            f"Missing required columns: {missing_cols}"
        )
        save_json(validation_summary, dataset_dir / "validation_summary.json")
        return validation_summary

    # Parse dates
    try:
        df["period_start"] = pd.to_datetime(df["period_start"])
    except Exception as e:
        validation_summary["errors"].append(f"Failed to parse period_start as date: {e}")
        save_json(validation_summary, dataset_dir / "validation_summary.json")
        return validation_summary

    # Detect grain
    try:
        grain = detect_grain(df, "period_start")
        validation_summary["grain"] = grain
    except Exception as e:
        validation_summary["warnings"].append(f"Could not detect grain: {e}")

    # Check uniqueness of (entity_id, period_start)
    duplicates = df.duplicated(subset=["entity_id", "period_start"]).sum()
    if duplicates > 0:
        validation_summary["errors"].append(
            f"Found {duplicates} duplicate (entity_id, period_start) combinations"
        )

    # Detect column types
    act_cols = [col for col in df.columns if col.startswith("act_")]
    ctrl_cols = [col for col in df.columns if col.startswith("ctrl_")]
    spend_cols = [col for col in df.columns if col.startswith("spend_")]

    validation_summary["column_types"] = {
        "required": required_cols,
        "activity_drivers": act_cols,
        "controls": ctrl_cols,
        "spend": spend_cols
    }

    if not act_cols:
        validation_summary["warnings"].append(
            "No activity driver columns found (expected columns starting with 'act_')"
        )

    # Check missingness
    for col in df.columns:
        missing_pct = (df[col].isna().sum() / len(df)) * 100
        if missing_pct > 0:
            validation_summary["missingness"][col] = round(missing_pct, 2)

        if col in required_cols + act_cols and missing_pct > 0:
            validation_summary["warnings"].append(
                f"Column '{col}' has {missing_pct:.1f}% missing values"
            )

    # Check data types
    if not pd.api.types.is_numeric_dtype(df["sales"]):
        validation_summary["errors"].append("Column 'sales' must be numeric")

    for col in act_cols + spend_cols:
        if col in df.columns and not pd.api.types.is_numeric_dtype(df[col]):
            validation_summary["errors"].append(f"Column '{col}' must be numeric")

    # Time coverage
    if "period_start" in df.columns:
        min_date = df["period_start"].min()
        max_date = df["period_start"].max()
        coverage_months = (max_date - min_date).days / 30.44
        validation_summary["time_coverage_months"] = round(coverage_months, 1)

        if coverage_months < 12:
            validation_summary["warnings"].append(
                f"Limited time coverage: {coverage_months:.1f} months (minimum 12 recommended)"
            )

    # Entity count
    validation_summary["entity_count"] = df["entity_id"].nunique()

    # Save validation summary
    save_json(validation_summary, dataset_dir / "validation_summary.json")

    return validation_summary


def is_valid(validation_summary: Dict[str, Any]) -> bool:
    """Check if validation passed (no errors)."""
    return len(validation_summary.get("errors", [])) == 0
