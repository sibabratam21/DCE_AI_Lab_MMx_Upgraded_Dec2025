"""Canonicalize dataset to standard format."""
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from .storage import get_run_dir, save_parquet, save_json


def canonicalize_dataset(
    run_id: str,
    df: pd.DataFrame,
    grain: str
) -> pd.DataFrame:
    """
    Convert dataset to canonical format and aggregate to brand-time level.

    For v1, we aggregate across all entity_id values to create a single
    brand-level time series. This keeps runtime manageable.

    Args:
        run_id: Run identifier
        df: Raw dataset
        grain: Time grain (WEEK/MONTH)

    Returns:
        Canonicalized DataFrame
    """
    run_dir = get_run_dir(run_id)

    # Ensure period_start is datetime
    df = df.copy()
    df["period_start"] = pd.to_datetime(df["period_start"])

    # Sort by date
    df = df.sort_values("period_start")

    # Detect column types
    act_cols = [col for col in df.columns if col.startswith("act_")]
    ctrl_cols = [col for col in df.columns if col.startswith("ctrl_")]
    spend_cols = [col for col in df.columns if col.startswith("spend_")]

    # Aggregate to brand-time level
    # Sales and activity: sum across entities
    # Controls: mean across entities
    # Spend: sum across entities

    agg_dict = {
        "sales": "sum"
    }

    for col in act_cols:
        agg_dict[col] = "sum"

    for col in ctrl_cols:
        agg_dict[col] = "mean"

    for col in spend_cols:
        agg_dict[col] = "sum"

    # Group by period and aggregate
    canonical = df.groupby("period_start").agg(agg_dict).reset_index()

    # Add metadata
    canonical["grain"] = grain

    # Save canonical data
    save_parquet(canonical, run_dir / "canonical_data.parquet")

    # Save column mapping
    column_info = {
        "target": "sales",
        "drivers": act_cols,
        "controls": ctrl_cols,
        "spend": spend_cols,
        "aggregation_level": "brand_total",
        "entity_count_original": df["entity_id"].nunique() if "entity_id" in df.columns else 1
    }

    save_json(column_info, run_dir / "column_info.json")

    return canonical
