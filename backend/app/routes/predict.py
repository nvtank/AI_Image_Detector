import io
import logging
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image

from app.config import settings
from app.core.auth import get_current_user
from app.schemas import ExplainResponse, PredictResponse, PredictUrlRequest
from app.services.cloudinary_service import upload_image_to_cloudinary
from app.services.gradcam_service import gradcam_service
from app.services.inference_service import inference_service
from app.services.logging_service import logging_service

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
async def predict_image(
    file: UploadFile = File(...),
    source_type: str = Form("upload"),
    current_user: dict = Depends(get_current_user),
):
    """Upload an image for AI detection. Requires authentication."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB.")

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
async def predict_image_url(
    request: PredictUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """Predict AI image from URL. Requires authentication."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream("GET", request.image_url) as response:
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
        image_url=cdn.get("cloudinary_secure_url") or request.image_url,
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
        image_url=cdn.get("cloudinary_secure_url") or request.image_url,
        thumbnail_url=cdn.get("cloudinary_thumbnail_url"),
        cloudinary_public_id=cdn.get("cloudinary_public_id"),
        cloudinary_warning=warning,
    )


@router.post("/explain", response_model=ExplainResponse, tags=["inference"])
async def explain_image(
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
