from fastapi import APIRouter, Query
from typing import List
from app.schemas import PredictionLog
from app.services.logging_service import logging_service

router = APIRouter()

@router.get("/history", response_model=List[PredictionLog], tags=["history"])
async def get_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get prediction history.
    """
    logs = logging_service.get_history(limit=limit, offset=offset)
    return logs
