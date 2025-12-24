"""Runs API endpoints."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Any, List
import uuid
from datetime import datetime

from core.storage import get_run_dir, get_dataset_dir, load_parquet, load_json, save_json
from core.canonicalize import canonicalize_dataset
from core.features import build_features
from core.model_pymc import train_bayesian_mmm
from core.diagnostics import compute_diagnostics
from core.contributions import compute_contributions, compute_roi_metrics, compute_fitted_values
from core.status import RunStatus, RunStage


router = APIRouter(prefix="/runs", tags=["runs"])


class RunSpec(BaseModel):
    """Run specification for MMM training."""
    dataset_id: str
    grain: str = Field(default="WEEK", description="Time grain (WEEK or MONTH)")
    target_col: str = Field(default="sales", description="Target column name")
    drivers: List[str] = Field(default_factory=list, description="Driver columns (act_* columns)")
    controls: List[str] = Field(default_factory=list, description="Control columns (ctrl_* columns)")

    # Feature engineering config
    feature_config: Dict[str, Any] = Field(default_factory=dict)

    # Time windows
    windows: Dict[str, int] = Field(
        default_factory=lambda: {
            "carryover_months": 12,
            "estimation_months": 12
        }
    )

    # Sampling config
    draws: int = Field(default=1000, description="MCMC draws per chain")
    tune: int = Field(default=1000, description="MCMC tuning steps")
    chains: int = Field(default=2, description="Number of MCMC chains")
    target_accept: float = Field(default=0.9, description="Target acceptance rate")

    # Random seed
    random_seed: int = Field(default=42, description="Random seed for reproducibility")


class RunInfo(BaseModel):
    """Run metadata and status."""
    run_id: str
    dataset_id: str
    stage: str
    progress: int
    started_at: str | None
    updated_at: str | None
    error: str | None


@router.post("/create")
async def create_run(
    spec: RunSpec,
    background_tasks: BackgroundTasks
) -> Dict[str, str]:
    """
    Create a new MMM run.

    This endpoint:
    1. Creates a run directory
    2. Saves the run spec
    3. Starts the training pipeline in the background

    Args:
        spec: Run specification
        background_tasks: FastAPI background tasks

    Returns:
        Run ID
    """
    # Generate run ID
    run_id = f"run_{uuid.uuid4().hex[:8]}"

    # Verify dataset exists
    dataset_dir = get_dataset_dir(spec.dataset_id)
    if not (dataset_dir / "raw_data.parquet").exists():
        raise HTTPException(status_code=404, detail=f"Dataset {spec.dataset_id} not found")

    # Create run directory
    run_dir = get_run_dir(run_id)

    # Save run spec
    save_json(spec.model_dump(), run_dir / "run_spec.json")

    # Initialize status
    status = RunStatus(run_id)
    status.update(RunStage.CREATED, progress=0)

    # Start training pipeline in background
    background_tasks.add_task(run_mmm_pipeline, run_id, spec)

    return {
        "run_id": run_id,
        "status": "started"
    }


def run_mmm_pipeline(run_id: str, spec: RunSpec) -> None:
    """
    Execute the full MMM pipeline.

    Steps:
    1. Load and canonicalize dataset
    2. Build features
    3. Train Bayesian MMM
    4. Compute diagnostics
    5. Compute contributions and ROI
    6. Generate fitted values

    Args:
        run_id: Run identifier
        spec: Run specification
    """
    status = RunStatus(run_id)

    try:
        # Step 1: Canonicalize dataset
        status.update(RunStage.VALIDATED, progress=10)

        dataset_dir = get_dataset_dir(spec.dataset_id)
        df = load_parquet(dataset_dir / "raw_data.parquet")

        canonicalize_dataset(run_id, df, spec.grain)

        # Step 2: Build features
        status.update(RunStage.FEATURES_BUILT, progress=25)

        build_features(run_id, spec.model_dump())

        # Step 3: Train model
        status.update(RunStage.TRAINING, progress=40)

        train_bayesian_mmm(
            run_id=run_id,
            run_spec=spec.model_dump(),
            draws=spec.draws,
            tune=spec.tune,
            chains=spec.chains,
            target_accept=spec.target_accept
        )

        status.update(RunStage.TRAINED, progress=70)

        # Step 4: Diagnostics
        compute_diagnostics(run_id)

        # Step 5: Contributions
        compute_contributions(run_id)
        compute_roi_metrics(run_id)
        compute_fitted_values(run_id)

        # Complete
        status.update(RunStage.OUTPUTS_READY, progress=100)

    except Exception as e:
        status.set_error(str(e))
        raise


@router.get("/{run_id}/status")
async def get_run_status(run_id: str) -> RunInfo:
    """
    Get run status.

    Args:
        run_id: Run identifier

    Returns:
        Run status information
    """
    run_dir = get_run_dir(run_id)

    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    # Load run spec
    spec = load_json(run_dir / "run_spec.json")

    # Load status
    status = RunStatus(run_id)
    status_data = status.get()

    return RunInfo(
        run_id=run_id,
        dataset_id=spec["dataset_id"],
        stage=status_data["stage"],
        progress=status_data["progress"],
        started_at=status_data.get("started_at"),
        updated_at=status_data.get("updated_at"),
        error=status_data.get("error")
    )


@router.get("/{run_id}/spec")
async def get_run_spec(run_id: str) -> Dict[str, Any]:
    """
    Get run specification.

    Args:
        run_id: Run identifier

    Returns:
        Run specification
    """
    run_dir = get_run_dir(run_id)
    spec_path = run_dir / "run_spec.json"

    if not spec_path.exists():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    return load_json(spec_path)


@router.delete("/{run_id}")
async def delete_run(run_id: str) -> Dict[str, str]:
    """
    Delete a run.

    Args:
        run_id: Run identifier

    Returns:
        Deletion confirmation
    """
    run_dir = get_run_dir(run_id)

    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    # Delete directory and all contents
    import shutil
    shutil.rmtree(run_dir)

    return {
        "status": "deleted",
        "run_id": run_id
    }


@router.get("/")
async def list_runs() -> List[RunInfo]:
    """
    List all runs.

    Returns:
        List of run metadata
    """
    from core.storage import ARTIFACTS_DIR

    runs_dir = ARTIFACTS_DIR / "runs"

    if not runs_dir.exists():
        return []

    runs = []

    for run_dir in runs_dir.iterdir():
        if run_dir.is_dir() and run_dir.name.startswith("run_"):
            spec_path = run_dir / "run_spec.json"
            status_path = run_dir / "status.json"

            if spec_path.exists():
                spec = load_json(spec_path)

                status = RunStatus(run_dir.name)
                status_data = status.get()

                runs.append(RunInfo(
                    run_id=run_dir.name,
                    dataset_id=spec.get("dataset_id", "unknown"),
                    stage=status_data["stage"],
                    progress=status_data["progress"],
                    started_at=status_data.get("started_at"),
                    updated_at=status_data.get("updated_at"),
                    error=status_data.get("error")
                ))

    return runs
