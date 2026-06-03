import io
import logging
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from PIL import Image

from app.config import settings
from app.core.auth import get_current_user
from app.services.auth_service import deduct_user_token
from app.middleware.rate_limiter import limiter
from app.schemas import (
    ExplainResponse, PredictResponse, PredictUrlRequest,
    HybridPredictionResponse, LocalModelResult, GeminiAnalysisResponse
)
from app.services.cloudinary_service import upload_image_to_cloudinary
from app.services.gradcam_service import gradcam_service
from app.services.inference_service import inference_service
from app.services.logging_service import logging_service
from app.services.gemini_service import gemini_service
from app.services.hybrid_decision_service import hybrid_decision_service
from app.services.security_audit_service import security_audit_service

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _try_cloudinary_upload(file_bytes: bytes, filename: str, user_id: int) -> dict:
    """Upload to Cloudinary if enabled. Returns empty dict on failure (non-fatal)."""
    if not settings.ENABLE_CLOUDINARY_UPLOAD:
        return {}
    try:
        return upload_image_to_cloudinary(file_bytes, filename, user_id)
    except Exception as e:
        logger.warning(f"Cloudinary upload failed (non-fatal): {e}")
        return {"_warning": "Image saved but Cloudinary upload failed. Prediction result is still valid."}


@router.post("/predict", response_model=PredictResponse, tags=["inference"])
@limiter.limit("20/minute")
async def predict_image(
    request: Request,
    file: UploadFile = File(...),
    source_type: str = Form("upload"),
    current_user: dict = Depends(get_current_user),
):
    """Upload an image for AI detection. Requires authentication. Rate limit: 20/min."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        security_audit_service.log_event(
            event_type="INVALID_FILE_UPLOAD",
            ip_address=request.client.host if request.client else None,
            endpoint="/predict",
            method="POST",
            user_id=current_user.get("id"),
            details=f"Invalid MIME type: {file.content_type}",
            severity="WARNING",
        )
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB.")

    # Token balance check & deduction
    if not deduct_user_token(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Bạn đã hết lượt phân tích. Vui lòng nạp thêm token hoặc nâng cấp gói cước."
        )

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse image file.")

    result = inference_service.predict(image)

    # Cloudinary upload (non-fatal)
    cdn = _try_cloudinary_upload(contents, file.filename or "upload.jpg", current_user["id"])
    warning = cdn.pop("_warning", None)

    logging_service.log_prediction(
        source_type=source_type,
        image_name=file.filename,
        image_url=cdn.get("cloudinary_secure_url"),
        predicted_label=result["label"],
        confidence=result["confidence"],
        fake_probability=result["fake_probability"],
        real_probability=result["real_probability"],
        model_name=result["model_used"],
        model_version=settings.VERSION,
        processing_time_ms=result["processing_time_ms"],
        user_id=current_user["id"],
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        image_format=cdn.get("cloudinary_format"),
        image_width=cdn.get("cloudinary_width"),
        image_height=cdn.get("cloudinary_height"),
        image_bytes=cdn.get("cloudinary_bytes"),
    )

    return PredictResponse(
        label=result["label"],
        confidence=result["confidence"],
        fake_probability=result["fake_probability"],
        real_probability=result["real_probability"],
        model_name=result["model_used"],
        model_version=settings.VERSION,
        processing_time_ms=result["processing_time_ms"],
        image_url=cdn.get("cloudinary_secure_url"),
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        cloudinary_warning=warning,
    )


@router.post("/predict-url", response_model=PredictResponse, tags=["inference"])
@limiter.limit("15/minute")
async def predict_image_url(
    request: Request,
    body: PredictUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """Predict AI image from URL. Requires authentication."""
    # Token balance check & deduction
    if not deduct_user_token(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Bạn đã hết lượt phân tích. Vui lòng nạp thêm token hoặc nâng cấp gói cước."
        )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream("GET", body.image_url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch image. Status: {response.status_code}")

                content_type = response.headers.get("content-type", "")
                if not content_type.startswith("image/"):
                    raise HTTPException(status_code=400, detail=f"URL does not point to an image. Content-Type: {content_type}")

                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > MAX_BYTES:
                    raise HTTPException(status_code=400, detail=f"Image exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.")

                contents = bytearray()
                async for chunk in response.aiter_bytes():
                    contents.extend(chunk)
                    if len(contents) > MAX_BYTES:
                        raise HTTPException(status_code=400, detail="Image exceeded size limit during download.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timed out after 10 seconds.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")
    except HTTPException:
        raise

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Downloaded content is not a valid image.")

    result = inference_service.predict(image)

    # Try upload fetched image to Cloudinary
    cdn = _try_cloudinary_upload(bytes(contents), "url_image.jpg", current_user["id"])
    warning = cdn.pop("_warning", None)

    logging_service.log_prediction(
        source_type="url",
        image_name=None,
        image_url=cdn.get("cloudinary_secure_url") or body.image_url,
        predicted_label=result["label"],
        confidence=result["confidence"],
        fake_probability=result["fake_probability"],
        real_probability=result["real_probability"],
        model_name=result["model_used"],
        model_version=settings.VERSION,
        processing_time_ms=result["processing_time_ms"],
        user_id=current_user["id"],
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        image_format=cdn.get("cloudinary_format"),
        image_width=cdn.get("cloudinary_width"),
        image_height=cdn.get("cloudinary_height"),
        image_bytes=cdn.get("cloudinary_bytes"),
    )

    return PredictResponse(
        label=result["label"],
        confidence=result["confidence"],
        fake_probability=result["fake_probability"],
        real_probability=result["real_probability"],
        model_name=result["model_used"],
        model_version=settings.VERSION,
        processing_time_ms=result["processing_time_ms"],
        image_url=cdn.get("cloudinary_secure_url") or body.image_url,
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        cloudinary_warning=warning,
    )


@router.post("/explain", response_model=ExplainResponse, tags=["inference"])
@limiter.limit("10/minute")
async def explain_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Generate Grad-CAM heatmap. Requires authentication."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        result = gradcam_service.explain(image)
        return ExplainResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grad-CAM failed: {str(e)}")


@router.post("/predict-hybrid", response_model=HybridPredictionResponse, tags=["inference"])
@limiter.limit("20/minute")
async def predict_image_hybrid(
    request: Request,
    file: UploadFile = File(...),
    use_gemini: bool = Form(True),
    source_type: str = Form("upload"),
    current_user: dict = Depends(get_current_user),
):
    """
    Perform Hybrid AI image detection by combining PyTorch local model 
    and Gemini Multimodal analysis. Requires authentication.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        security_audit_service.log_event(
            event_type="INVALID_FILE_UPLOAD",
            ip_address=request.client.host if request.client else None,
            endpoint="/predict-hybrid",
            method="POST",
            user_id=current_user.get("id"),
            details=f"Invalid MIME type: {file.content_type}",
            severity="WARNING",
        )
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB.")

    # Tier check for Gemini feature
    if use_gemini and current_user.get("subscription_tier", "free") == "free":
        raise HTTPException(
            status_code=403,
            detail="Chức năng phân tích lai (Gemini Second Opinion) yêu cầu nâng cấp lên gói Plus hoặc Pro."
        )

    # Token balance check & deduction
    if not deduct_user_token(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Bạn đã hết lượt phân tích. Vui lòng nạp thêm token hoặc nâng cấp gói cước."
        )

    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse image file.")

    # 1. Run Local Model
    result = inference_service.predict(image)

    # 2. Upload Cloudinary (non-fatal)
    cdn = _try_cloudinary_upload(contents, file.filename or "upload.jpg", current_user["id"])
    warning = cdn.pop("_warning", None)

    # 3. Run Gemini Analysis if requested & enabled
    if use_gemini and settings.ENABLE_GEMINI_ANALYSIS:
        gemini_result = await gemini_service.analyze_image_with_gemini(
            image_bytes=contents,
            local_prediction=result,
            image_mime=file.content_type
        )
    else:
        gemini_result = {
            "predicted_label": "UNCERTAIN",
            "confidence_level": "low",
            "reasoning_summary": "Phân tích Gemini không được kích hoạt hoặc bị tắt bởi người dùng.",
            "visual_signals": ["Không có phân tích"],
            "limitations": "Gemini analysis was bypassed.",
            "error": True
        }

    # 4. Compute combined Hybrid Decision
    decision = hybrid_decision_service.combine_local_and_gemini(result, gemini_result)

    # 5. Log Hybrid prediction to Database
    logging_service.log_prediction(
        source_type=source_type,
        image_name=file.filename,
        image_url=cdn.get("cloudinary_secure_url"),
        predicted_label=decision["final_decision"], # final hybrid label is stored in standard label column for compatibility
        confidence=result["confidence"],
        fake_probability=result["fake_probability"],
        real_probability=result["real_probability"],
        model_name=result["model_used"],
        model_version=settings.VERSION,
        processing_time_ms=result["processing_time_ms"],
        user_id=current_user["id"],
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        image_format=cdn.get("cloudinary_format"),
        image_width=cdn.get("cloudinary_width"),
        image_height=cdn.get("cloudinary_height"),
        image_bytes=cdn.get("cloudinary_bytes"),
        
        # New Hybrid columns
        local_predicted_label=result["label"],
        local_confidence=result["confidence"],
        gemini_predicted_label=gemini_result.get("predicted_label"),
        gemini_confidence_level=f"{gemini_result.get('confidence_level')} (Score: {gemini_result.get('confidence_score', 0.0)})",
        gemini_reasoning_summary=gemini_result.get("reasoning_summary"),
        gemini_visual_signals=gemini_result.get("evidence_for_fake", []) + gemini_result.get("evidence_for_real", []) + gemini_result.get("uncertainty_reasons", []),
        gemini_limitations=gemini_result.get("recommendation"),
        agreement_status=decision["agreement_status"],
        final_decision=decision["final_decision"],
        used_gemini=(use_gemini and settings.ENABLE_GEMINI_ANALYSIS)
    )

    # 6. Construct Hybrid Response
    gemini_analysis_response = None
    if not (gemini_result.get("error") and not use_gemini):
        combined_signals = (
            gemini_result.get("evidence_for_fake", []) +
            gemini_result.get("evidence_for_real", []) +
            gemini_result.get("uncertainty_reasons", [])
        )
        gemini_analysis_response = GeminiAnalysisResponse(
            predicted_label=gemini_result["predicted_label"],
            confidence_score=gemini_result.get("confidence_score", 0.0),
            confidence_level=gemini_result["confidence_level"],
            evidence_for_fake=gemini_result.get("evidence_for_fake", []),
            evidence_for_real=gemini_result.get("evidence_for_real", []),
            uncertainty_reasons=gemini_result.get("uncertainty_reasons", []),
            reasoning_summary=gemini_result["reasoning_summary"],
            recommendation=gemini_result.get("recommendation", ""),
            should_trust_result=gemini_result.get("should_trust_result", False),
            visual_signals=combined_signals,
            limitations=gemini_result.get("recommendation", ""),
            error=gemini_result.get("error")
        )

    return HybridPredictionResponse(
        final_decision=decision["final_decision"],
        agreement_status=decision["agreement_status"],
        local_model=LocalModelResult(
            predicted_label=result["label"],
            confidence=result["confidence"],
            fake_probability=result["fake_probability"],
            real_probability=result["real_probability"],
            model_name=result["model_used"],
            processing_time_ms=result["processing_time_ms"]
        ),
        gemini_analysis=gemini_analysis_response,
        recommendation=decision["recommendation"],
        image_url=cdn.get("cloudinary_secure_url"),
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_warning=warning
    )


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Async Endpoint — returns task_id immediately (non-blocking)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/predict-hybrid-async", status_code=202, tags=["inference", "async"])
@limiter.limit("20/minute")
async def predict_hybrid_async(
    request: Request,
    file: UploadFile = File(...),
    use_gemini: bool = Form(True),
    source_type: str = Form("upload"),
    current_user: dict = Depends(get_current_user),
):
    """
    Async Hybrid AI Detection — Phase 3 Architecture.
    
    Unlike /predict-hybrid (blocking, waits for full pipeline ~5-15s),
    this endpoint:
      1. Reads + validates the uploaded file (~instant)
      2. Uploads to Cloudinary for durable storage (~1-2s)
      3. Encodes image as base64 and enqueues Celery task (~instant)
      4. Returns HTTP 202 Accepted + task_id immediately
    
    The client then polls GET /tasks/{task_id} every 2 seconds to track
    pipeline progress and retrieve the final result when complete.
    
    Rate limit: 20/min per user.
    Returns: { task_id, status: "queued", message }
    """
    import base64

    # Tier check: Async Queue Mode requires Pro tier
    if current_user.get("subscription_tier", "free") != "pro":
        raise HTTPException(
            status_code=403,
            detail="Chế độ Hàng đợi Bất đồng bộ (Async Queue Mode) yêu cầu nâng cấp lên gói Pro."
        )

    # ── Validate file type ────────────────────────────────────────────────
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        security_audit_service.log_event(
            event_type="INVALID_FILE_UPLOAD",
            ip_address=request.client.host if request.client else None,
            endpoint="/predict-hybrid-async",
            method="POST",
            user_id=current_user.get("id"),
            details=f"Invalid MIME type: {file.content_type}",
            severity="WARNING",
        )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # Basic image validation (can it be opened?)
    try:
        Image.open(io.BytesIO(contents)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot parse image file.")

    # ── Upload to Cloudinary BEFORE enqueuing ─────────────────────────────
    # We upload here (in FastAPI, not in worker) so:
    #   a) Worker doesn't need to handle the raw bytes transfer
    #   b) Image is durably stored even if worker crashes
    cdn = _try_cloudinary_upload(
        contents, file.filename or "upload.jpg", current_user["id"]
    )
    cdn.pop("_warning", None)  # Remove internal-only key

    # ── Encode image for task queue ───────────────────────────────────────
    # Celery serializes task arguments as JSON, so we base64-encode the bytes
    image_b64 = base64.b64encode(contents).decode("utf-8")

    # ── Enqueue Celery task ───────────────────────────────────────────────
    from app.worker.tasks import run_hybrid_inference
    task = run_hybrid_inference.apply_async(
        kwargs={
            "image_b64": image_b64,
            "filename": file.filename or "upload.jpg",
            "use_gemini": use_gemini,
            "source_type": source_type,
            "user_id": current_user["id"],
            "image_mime": file.content_type,
            "cdn_data": cdn,
        },
        queue="ai_inference",
    )

    logger.info(
        f"[Async] Task {task.id} queued for user {current_user['id']}: "
        f"{file.filename} ({len(contents)//1024}KB) use_gemini={use_gemini}"
    )

    return {
        "task_id": task.id,
        "status": "queued",
        "message": "Yêu cầu phân tích đã được xếp hàng. Theo dõi tiến trình qua GET /tasks/{task_id}.",
        "poll_url": f"/tasks/{task.id}",
    }
