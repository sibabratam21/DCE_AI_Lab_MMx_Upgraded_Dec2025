"""Status tracking for MMM runs."""
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional
from .storage import get_run_dir, save_json, load_json


class RunStage(str, Enum):
    """Stages of a run lifecycle."""
    CREATED = "CREATED"
    VALIDATED = "VALIDATED"
    FEATURES_BUILT = "FEATURES_BUILT"
    TRAINING = "TRAINING"
    TRAINED = "TRAINED"
    OUTPUTS_READY = "OUTPUTS_READY"
    ERROR = "ERROR"


class RunStatus:
    """Manage status for a run."""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.status_file = get_run_dir(run_id) / "status.json"

    def get(self) -> dict:
        """Get current status."""
        if not self.status_file.exists():
            return {
                "stage": RunStage.CREATED,
                "progress": 0,
                "started_at": None,
                "updated_at": None,
                "error": None
            }
        return load_json(self.status_file)

    def update(
        self,
        stage: RunStage,
        progress: int = 0,
        error: Optional[str] = None
    ) -> None:
        """Update status."""
        current = self.get()

        status = {
            "stage": stage.value,
            "progress": progress,
            "started_at": current.get("started_at") or datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "error": error
        }

        save_json(status, self.status_file)

    def set_error(self, error_message: str) -> None:
        """Set error status."""
        self.update(RunStage.ERROR, progress=0, error=error_message)

    def is_complete(self) -> bool:
        """Check if run is complete."""
        status = self.get()
        return status["stage"] == RunStage.OUTPUTS_READY

    def is_error(self) -> bool:
        """Check if run has error."""
        status = self.get()
        return status["stage"] == RunStage.ERROR
