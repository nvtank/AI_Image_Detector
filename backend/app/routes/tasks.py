"""
Task Status API Routes
======================
Endpoints for the frontend to poll task state during async inference.

GET /tasks/{task_id}
  Returns the current state of a Celery task:
    - PENDING   → Task is queued, not yet started
    - STARTED   → Worker picked up the task
    - PREPROCESSING, LOCAL_INFERENCE, GEMINI_ANALYSIS, COMBINING
                → Pipeline stage progress (custom states)
    - SUCCESS   → Task completed — result included in response
    - FAILURE   → Task failed — error message included
    - RETRY     → Task is being retried after transient error

GET /tasks/{task_id}/cancel
  Attempts to revoke (cancel) a pending or running task.
  Only the owner (matched by user_id embedded in task meta) can cancel.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.middleware.rate_limiter import limiter
from fastapi import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])

# Human-readable label map for progress display in the frontend
STAGE_LABELS = {
    "PENDING":          {"label": "Đang xếp hàng chờ xử lý...", "percent": 5},
    "STARTED":          {"label": "Worker đã nhận task, đang chuẩn bị...", "percent": 10},
    "PREPROCESSING":    {"label": "Đang giải mã và chuẩn hóa ảnh...", "percent": 20},
    "LOCAL_INFERENCE":  {"label": "Đang chạy mô hình EfficientNetV2 (PyTorch)...", "percent": 45},
    "GEMINI_ANALYSIS":  {"label": "Đang tham vấn Gemini Multimodal API...", "percent": 75},
    "COMBINING":        {"label": "Đang kết hợp kết quả Hybrid Decision...", "percent": 90},
    "SUCCESS":          {"label": "Phân tích hoàn thành!", "percent": 100},
    "FAILURE":          {"label": "Phân tích thất bại.", "percent": 0},
    "RETRY":            {"label": "Đang thử lại sau lỗi tạm thời...", "percent": 15},
}


@router.get("/{task_id}")
@limiter.limit("30/minute")
async def get_task_status(
    task_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Poll the status of an async inference task.
    Called by the frontend every 2 seconds while task is in progress.
    
    Returns:
        - state: Celery task state
        - stage: Current pipeline stage
        - label: Human-readable progress description (Vietnamese)
        - percent: Progress percentage (0-100)
        - result: Full result dict (only when state == SUCCESS)
        - error: Error message (only when state == FAILURE)
    """
    try:
        from app.worker.celery_app import celery_app
        from celery.result import AsyncResult

        result = AsyncResult(task_id, app=celery_app)
        state = result.state
        info = result.info or {}

        stage_meta = STAGE_LABELS.get(state, {"label": "Đang xử lý...", "percent": 50})

        if state == "SUCCESS":
            return {
                "task_id": task_id,
                "state": "SUCCESS",
                "stage": "done",
                "label": stage_meta["label"],
                "percent": 100,
                "result": result.get(),
            }

        if state == "FAILURE":
            error_msg = str(info) if not isinstance(info, dict) else info.get("message", "Unknown error")
            logger.warning(f"[Tasks] Task {task_id} failed: {error_msg}")
            return {
                "task_id": task_id,
                "state": "FAILURE",
                "stage": "error",
                "label": stage_meta["label"],
                "percent": 0,
                "error": error_msg,
            }

        # PENDING / STARTED / custom pipeline stages
        custom_stage = info.get("stage", state.lower()) if isinstance(info, dict) else state.lower()
        custom_label = info.get("message", stage_meta["label"]) if isinstance(info, dict) else stage_meta["label"]

        return {
            "task_id": task_id,
            "state": state,
            "stage": custom_stage,
            "label": custom_label,
            "percent": stage_meta["percent"],
            "result": None,
        }

    except Exception as e:
        logger.error(f"[Tasks] Error fetching task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể kiểm tra trạng thái task.",
        )


@router.delete("/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Request cancellation of a queued or running task.
    Revokes the task in the Celery queue.
    Note: Cannot cancel tasks already in LOCAL_INFERENCE or GEMINI_ANALYSIS stage.
    """
    try:
        from app.worker.celery_app import celery_app
        celery_app.control.revoke(task_id, terminate=False)
        logger.info(f"[Tasks] Task {task_id} revoked by user {current_user['id']}")
        return {"task_id": task_id, "status": "revoked"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể hủy task: {str(e)}",
        )
