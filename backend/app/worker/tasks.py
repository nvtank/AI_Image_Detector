"""
Celery Tasks — Async AI Inference Pipeline
==========================================
This module defines the actual background work units that Celery workers execute.

Task: run_hybrid_inference
  Input:  image_bytes (base64), filename, use_gemini, source_type, user_id,
          cloudinary CDN metadata (pre-uploaded before enqueuing)
  Output: Full HybridPredictionResponse-compatible dict stored in Redis result backend

The task reports fine-grained progress through custom_state updates so the
frontend can display animated pipeline stages:
  PENDING → STARTED → PREPROCESSING → LOCAL_INFERENCE → GEMINI_ANALYSIS → COMBINING → SUCCESS
"""

import base64
import io
import logging
from typing import Optional

from celery import Task
from PIL import Image

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """Base task class with error logging."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"[Celery] Task {task_id} FAILED: {exc}", exc_info=True)

    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"[Celery] Task {task_id} completed successfully")


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="app.worker.tasks.run_hybrid_inference",
    queue="ai_inference",
    max_retries=2,
    default_retry_delay=5,
)
def run_hybrid_inference(
    self: Task,
    image_b64: str,
    filename: str,
    use_gemini: bool,
    source_type: str,
    user_id: int,
    image_mime: str,
    cdn_data: Optional[dict] = None,
) -> dict:
    """
    Background Celery task: Run full hybrid AI detection pipeline.
    Records Prometheus metrics at each stage for Grafana monitoring.
    """
    import time as _time
    _task_start = _time.perf_counter()

    # Record task start in Prometheus
    try:
        from app.services.prometheus_service import record_celery_task
        record_celery_task(state="queued")
    except Exception:
        pass

    try:
        # ── Stage 1: Decode image ──────────────────────────────────────────
        self.update_state(
            state="PREPROCESSING",
            meta={"stage": "preprocessing", "message": "Đang giải mã ảnh..."}
        )
        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        logger.info(f"[Task {self.request.id}] Image decoded: {filename}")

        # ── Stage 2: Local PyTorch Model Inference ─────────────────────────
        self.update_state(
            state="LOCAL_INFERENCE",
            meta={"stage": "local_inference", "message": "Đang phân tích bằng mô hình AI nội bộ (PyTorch)..."}
        )
        from app.services.inference_service import inference_service
        local_result = inference_service.predict(image)
        logger.info(
            f"[Task {self.request.id}] Local model: {local_result['label']} "
            f"({local_result['confidence']:.1%}) in {local_result['processing_time_ms']}ms"
        )
        # Record local inference latency in Prometheus
        try:
            from app.services.prometheus_service import inference_latency_seconds, record_prediction
            inference_latency_seconds.labels(model_type="local").observe(
                local_result["processing_time_ms"] / 1000.0
            )
            record_prediction(label=local_result["label"], source="local")
        except Exception:
            pass

        # ── Stage 3: Gemini Multimodal Analysis ───────────────────────────
        from app.config import settings
        gemini_result = None
        if use_gemini and settings.ENABLE_GEMINI_ANALYSIS:
            self.update_state(
                state="GEMINI_ANALYSIS",
                meta={"stage": "gemini_analysis", "message": "Đang tham vấn Gemini AI về các dấu hiệu thị giác..."}
            )
            import asyncio
            from app.services.gemini_service import gemini_service
            
            # Run async Gemini call inside sync Celery task
            loop = asyncio.new_event_loop()
            try:
                gemini_result = loop.run_until_complete(
                    gemini_service.analyze_image_with_gemini(
                        image_bytes=image_bytes,
                        local_prediction=local_result,
                        image_mime=image_mime,
                    )
                )
            finally:
                loop.close()
            
            logger.info(
                f"[Task {self.request.id}] Gemini: {gemini_result.get('predicted_label', 'N/A')} "
                f"(confidence: {gemini_result.get('confidence_level', 'N/A')})"
            )
            # Record Gemini API success in Prometheus
            try:
                from app.services.prometheus_service import gemini_api_calls_total
                gemini_api_calls_total.labels(status="success").inc()
            except Exception:
                pass
        
        if gemini_result is None:
            gemini_result = {
                "predicted_label": "UNCERTAIN",
                "confidence_level": "low",
                "confidence_score": 0.0,
                "reasoning_summary": "Phân tích Gemini không được kích hoạt hoặc bị tắt.",
                "visual_signals": [],
                "evidence_for_fake": [],
                "evidence_for_real": [],
                "uncertainty_reasons": [],
                "limitations": "Gemini analysis was bypassed.",
                "recommendation": "",
                "should_trust_result": False,
                "error": True,
            }

        # ── Stage 4: Combine Decisions ────────────────────────────────────
        self.update_state(
            state="COMBINING",
            meta={"stage": "combining", "message": "Đang tổng hợp kết quả từ hai hệ thống..."}
        )
        from app.services.hybrid_decision_service import hybrid_decision_service
        decision = hybrid_decision_service.combine_local_and_gemini(local_result, gemini_result)
        # Record hybrid decision metrics
        try:
            from app.services.prometheus_service import record_prediction, record_hybrid_agreement
            record_prediction(label=decision["final_decision"], source="hybrid")
            record_hybrid_agreement(agreement_status=decision["agreement_status"])
        except Exception:
            pass

        # ── Stage 5: Log to Database ──────────────────────────────────────
        cdn = cdn_data or {}
        from app.services.logging_service import logging_service
        logging_service.log_prediction(
            source_type=source_type,
            image_name=filename,
            image_url=cdn.get("cloudinary_secure_url"),
            predicted_label=decision["final_decision"],
            confidence=local_result["confidence"],
            fake_probability=local_result["fake_probability"],
            real_probability=local_result["real_probability"],
            model_name=local_result["model_used"],
            model_version=settings.VERSION,
            processing_time_ms=local_result["processing_time_ms"],
            user_id=user_id,
            thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
            cloudinary_public_id=cdn.get("cloudinary_public_id"),
            image_format=cdn.get("cloudinary_format"),
            image_width=cdn.get("cloudinary_width"),
            image_height=cdn.get("cloudinary_height"),
            image_bytes=cdn.get("cloudinary_bytes"),
            local_predicted_label=local_result["label"],
            local_confidence=local_result["confidence"],
            gemini_predicted_label=gemini_result.get("predicted_label"),
            gemini_confidence_level=gemini_result.get("confidence_level"),
            gemini_reasoning_summary=gemini_result.get("reasoning_summary"),
            gemini_visual_signals=(
                gemini_result.get("evidence_for_fake", []) +
                gemini_result.get("evidence_for_real", []) +
                gemini_result.get("uncertainty_reasons", [])
            ),
            gemini_limitations=gemini_result.get("recommendation"),
            agreement_status=decision["agreement_status"],
            final_decision=decision["final_decision"],
            used_gemini=(use_gemini and settings.ENABLE_GEMINI_ANALYSIS),
        )
        logger.info(f"[Task {self.request.id}] Prediction logged to DB")

        # ── Return complete result ─────────────────────────────────────────
        return {
            "task_id": self.request.id,
            "status": "SUCCESS",
            "final_decision": decision["final_decision"],
            "agreement_status": decision["agreement_status"],
            "recommendation": decision["recommendation"],
            "local_model": {
                "predicted_label": local_result["label"],
                "confidence": local_result["confidence"],
                "fake_probability": local_result["fake_probability"],
                "real_probability": local_result["real_probability"],
                "model_name": local_result["model_used"],
                "processing_time_ms": local_result["processing_time_ms"],
            },
            "gemini_analysis": {
                "predicted_label": gemini_result["predicted_label"],
                "confidence_score": gemini_result.get("confidence_score", 0.0),
                "confidence_level": gemini_result["confidence_level"],
                "evidence_for_fake": gemini_result.get("evidence_for_fake", []),
                "evidence_for_real": gemini_result.get("evidence_for_real", []),
                "uncertainty_reasons": gemini_result.get("uncertainty_reasons", []),
                "reasoning_summary": gemini_result.get("reasoning_summary", ""),
                "recommendation": gemini_result.get("recommendation", ""),
                "should_trust_result": gemini_result.get("should_trust_result", False),
                "visual_signals": (
                    gemini_result.get("evidence_for_fake", []) +
                    gemini_result.get("evidence_for_real", [])
                ),
                "limitations": gemini_result.get("recommendation", ""),
                "error": gemini_result.get("error"),
            } if not gemini_result.get("error") else None,
            "image_url": cdn.get("cloudinary_secure_url"),
            "thumbnail_url": cdn.get("cloudinary_thumbnail_url"),
            "cloudinary_warning": None,
        }

    except Exception as exc:
        logger.error(f"[Task {self.request.id}] Error: {exc}", exc_info=True)
        # Record failure in Prometheus
        try:
            from app.services.prometheus_service import record_celery_task
            duration = _time.perf_counter() - _task_start
            record_celery_task(state="failure", duration_seconds=duration)
        except Exception:
            pass
        # Retry on transient errors (network, Gemini timeout, etc.)
        raise self.retry(exc=exc, countdown=5)
