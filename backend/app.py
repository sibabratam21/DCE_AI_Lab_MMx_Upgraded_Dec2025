"""FastAPI application for Bayesian MMM backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api import datasets, runs, outputs
from core.storage import ARTIFACTS_DIR


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup: ensure artifacts directory exists
    logger.info("Starting MMM Backend...")
    ARTIFACTS_DIR.mkdir(exist_ok=True, parents=True)
    (ARTIFACTS_DIR / "datasets").mkdir(exist_ok=True)
    (ARTIFACTS_DIR / "runs").mkdir(exist_ok=True)
    logger.info(f"Artifacts directory: {ARTIFACTS_DIR}")

    yield

    # Shutdown
    logger.info("Shutting down MMM Backend...")


# Create FastAPI app
app = FastAPI(
    title="Bayesian MMM API",
    description="Backend API for Marketing Mix Modeling using PyMC",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(datasets.router)
app.include_router(runs.router)
app.include_router(outputs.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Bayesian MMM API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "datasets": "/datasets",
            "runs": "/runs",
            "outputs": "/outputs",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "artifacts_dir": str(ARTIFACTS_DIR)
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
