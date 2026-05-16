from fastapi import APIRouter
from app.schemas import ModelsInfoResponse
from app.services.metrics_service import metrics_service

router = APIRouter()

@router.get("/models", response_model=ModelsInfoResponse, tags=["models"])
async def get_models():
    """
    Get active model and available models.
    """
    return metrics_service.get_models_info()
