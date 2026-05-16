from fastapi import APIRouter
from app.schemas import MetricsResponse
from app.services.metrics_service import metrics_service

router = APIRouter()

@router.get("/metrics", response_model=MetricsResponse, tags=["metrics"])
async def get_metrics():
    """
    Get detailed metrics from training and robustness experiments.
    """
    return metrics_service.get_detailed_metrics()
