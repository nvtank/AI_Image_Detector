from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas import HistoryItemResponse
from app.services.logging_service import logging_service
from app.core.auth import get_current_user

router = APIRouter()


@router.get("/history", response_model=List[HistoryItemResponse], tags=["history"])
async def get_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    label: Optional[str] = Query(None, description="Filter by label: FAKE or REAL"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get prediction history for the authenticated user only.
    Supports optional label filter (FAKE/REAL).
    """
    logs = logging_service.get_history(
        limit=limit,
        offset=offset,
        user_id=current_user["id"],
        label_filter=label,
    )
    return logs
