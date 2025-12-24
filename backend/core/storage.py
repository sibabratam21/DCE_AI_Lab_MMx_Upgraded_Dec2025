"""Storage utilities for managing run artifacts and datasets."""
import json
import shutil
from pathlib import Path
from typing import Any, Dict, Optional
import pandas as pd

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"
DATASETS_DIR = ARTIFACTS_DIR / "datasets"

# Ensure directories exist
ARTIFACTS_DIR.mkdir(exist_ok=True)
DATASETS_DIR.mkdir(exist_ok=True)


def get_run_dir(run_id: str) -> Path:
    """Get the directory for a specific run."""
    run_dir = ARTIFACTS_DIR / run_id
    run_dir.mkdir(exist_ok=True, parents=True)
    return run_dir


def get_dataset_dir(dataset_id: str) -> Path:
    """Get the directory for a specific dataset."""
    dataset_dir = DATASETS_DIR / dataset_id
    dataset_dir.mkdir(exist_ok=True, parents=True)
    return dataset_dir


def save_json(data: Dict[str, Any], file_path: Path) -> None:
    """Save dictionary as JSON file."""
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2, default=str)


def load_json(file_path: Path) -> Dict[str, Any]:
    """Load JSON file as dictionary."""
    with open(file_path, 'r') as f:
        return json.load(f)


def save_parquet(df: pd.DataFrame, file_path: Path) -> None:
    """Save DataFrame as parquet file."""
    df.to_parquet(file_path, index=False, engine='pyarrow')


def load_parquet(file_path: Path) -> pd.DataFrame:
    """Load parquet file as DataFrame."""
    return pd.read_parquet(file_path, engine='pyarrow')


def delete_run(run_id: str) -> None:
    """Delete all artifacts for a run."""
    run_dir = get_run_dir(run_id)
    if run_dir.exists():
        shutil.rmtree(run_dir)


def delete_dataset(dataset_id: str) -> None:
    """Delete a dataset."""
    dataset_dir = get_dataset_dir(dataset_id)
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)


def run_exists(run_id: str) -> bool:
    """Check if a run exists."""
    return get_run_dir(run_id).exists()


def dataset_exists(dataset_id: str) -> bool:
    """Check if a dataset exists."""
    return get_dataset_dir(dataset_id).exists()
