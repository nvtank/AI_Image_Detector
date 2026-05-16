from fastapi import APIRouter
from app.schemas import HealthCheckResponse
from app.config import settings

router = APIRouter()

@router.get("/health", response_model=HealthCheckResponse, tags=["health"])
async def health_check():
    """
    Check the health of the application.
    """
    return HealthCheckResponse(
        status="ok",
        service="ai-image-detector-api",
        version=settings.VERSION
    )
