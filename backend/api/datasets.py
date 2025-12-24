"""Datasets API endpoints."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import pandas as pd
import io
from pathlib import Path

from core.storage import get_dataset_dir, save_parquet, load_parquet, load_json
from core.validation import validate_dataset, is_valid


router = APIRouter(prefix="/datasets", tags=["datasets"])


class DatasetInfo(BaseModel):
    """Dataset metadata."""
    dataset_id: str
    row_count: int
    column_count: int
    grain: str | None
    time_coverage_months: float | None
    entity_count: int | None
    validation_status: str
    errors: List[str]
    warnings: List[str]


@router.post("/upload")
async def upload_dataset(
    dataset_id: str,
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Upload a CSV dataset and validate it.

    Expected columns:
    - entity_id (string)
    - period_start (date)
    - sales (numeric)
    - act_* (activity/driver columns)
    - ctrl_* (control variables)
    - spend_* (spend columns)

    Args:
        dataset_id: Unique identifier for this dataset
        file: CSV file upload

    Returns:
        Validation summary
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Read CSV
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # Save raw dataset
    dataset_dir = get_dataset_dir(dataset_id)
    save_parquet(df, dataset_dir / "raw_data.parquet")

    # Validate dataset
    try:
        validation_summary = validate_dataset(dataset_id, df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

    # Return validation summary
    return {
        "dataset_id": dataset_id,
        "status": "valid" if is_valid(validation_summary) else "invalid",
        "validation": validation_summary
    }


@router.get("/{dataset_id}")
async def get_dataset_info(dataset_id: str) -> DatasetInfo:
    """
    Get dataset metadata and validation summary.

    Args:
        dataset_id: Dataset identifier

    Returns:
        Dataset metadata
    """
    dataset_dir = get_dataset_dir(dataset_id)

    # Check if dataset exists
    if not (dataset_dir / "raw_data.parquet").exists():
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    # Load validation summary
    validation_summary = load_json(dataset_dir / "validation_summary.json")

    return DatasetInfo(
        dataset_id=dataset_id,
        row_count=validation_summary["row_count"],
        column_count=validation_summary["column_count"],
        grain=validation_summary.get("grain"),
        time_coverage_months=validation_summary.get("time_coverage_months"),
        entity_count=validation_summary.get("entity_count"),
        validation_status="valid" if is_valid(validation_summary) else "invalid",
        errors=validation_summary.get("errors", []),
        warnings=validation_summary.get("warnings", [])
    )


@router.get("/{dataset_id}/raw")
async def get_raw_data(
    dataset_id: str,
    limit: int | None = None
) -> Dict[str, Any]:
    """
    Get raw dataset as JSON.

    Args:
        dataset_id: Dataset identifier
        limit: Optional row limit

    Returns:
        Dataset as JSON records
    """
    dataset_dir = get_dataset_dir(dataset_id)
    raw_path = dataset_dir / "raw_data.parquet"

    if not raw_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    df = load_parquet(raw_path)

    if limit:
        df = df.head(limit)

    return {
        "dataset_id": dataset_id,
        "row_count": len(df),
        "columns": list(df.columns),
        "data": df.to_dict(orient="records")
    }


@router.get("/{dataset_id}/columns")
async def get_column_info(dataset_id: str) -> Dict[str, Any]:
    """
    Get column type information.

    Args:
        dataset_id: Dataset identifier

    Returns:
        Column type mapping
    """
    dataset_dir = get_dataset_dir(dataset_id)
    validation_path = dataset_dir / "validation_summary.json"

    if not validation_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    validation = load_json(validation_path)

    return {
        "dataset_id": dataset_id,
        "column_types": validation.get("column_types", {}),
        "missingness": validation.get("missingness", {})
    }


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str) -> Dict[str, str]:
    """
    Delete a dataset.

    Args:
        dataset_id: Dataset identifier

    Returns:
        Deletion confirmation
    """
    dataset_dir = get_dataset_dir(dataset_id)

    if not dataset_dir.exists():
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    # Delete directory and all contents
    import shutil
    shutil.rmtree(dataset_dir)

    return {
        "status": "deleted",
        "dataset_id": dataset_id
    }


@router.get("/")
async def list_datasets() -> List[DatasetInfo]:
    """
    List all datasets.

    Returns:
        List of dataset metadata
    """
    from core.storage import ARTIFACTS_DIR

    datasets_dir = ARTIFACTS_DIR / "datasets"

    if not datasets_dir.exists():
        return []

    datasets = []

    for dataset_dir in datasets_dir.iterdir():
        if dataset_dir.is_dir():
            validation_path = dataset_dir / "validation_summary.json"

            if validation_path.exists():
                validation = load_json(validation_path)

                datasets.append(DatasetInfo(
                    dataset_id=dataset_dir.name,
                    row_count=validation["row_count"],
                    column_count=validation["column_count"],
                    grain=validation.get("grain"),
                    time_coverage_months=validation.get("time_coverage_months"),
                    entity_count=validation.get("entity_count"),
                    validation_status="valid" if is_valid(validation) else "invalid",
                    errors=validation.get("errors", []),
                    warnings=validation.get("warnings", [])
                ))

    return datasets
