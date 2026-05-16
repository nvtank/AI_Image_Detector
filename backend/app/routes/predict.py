from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas import PredictResponse, PredictUrlRequest
from app.services.inference_service import inference_service
from app.services.logging_service import logging_service
from app.config import settings
from PIL import Image
import io
import httpx

router = APIRouter()

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

@router.post("/predict", response_model=PredictResponse, tags=["predict"])
async def predict_image(file: UploadFile = File(...)):
    """
    Upload an image for AI detection.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
        
    try:
        # Read file contents into memory
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Call the inference service
        result = inference_service.predict(image)
        
        # Log prediction
        logging_service.log_prediction(
            source_type="upload",
            image_name=file.filename,
            image_url=None,
            predicted_label=result["label"],
            confidence=result["confidence"],
            fake_probability=result["fake_probability"],
            real_probability=result["real_probability"],
            model_name=result["model_used"],
            model_version=settings.VERSION,
            processing_time_ms=result["processing_time_ms"]
        )
        
        # Prepare response mapping
        return PredictResponse(
            label=result["label"],
            confidence=result["confidence"],
            fake_probability=result["fake_probability"],
            real_probability=result["real_probability"],
            model_name=result["model_used"],
            model_version=settings.VERSION,
            processing_time_ms=result["processing_time_ms"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@router.post("/predict-url", response_model=PredictResponse, tags=["predict"])
async def predict_image_url(request: PredictUrlRequest):
    """
    Predict AI image from a given URL.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream('GET', request.image_url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch image. Status code: {response.status_code}")
                
                content_type = response.headers.get("content-type", "")
                if not content_type.startswith("image/"):
                    raise HTTPException(status_code=400, detail=f"URL does not point to a valid image. Content-Type: {content_type}")
                
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > 10 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail="Image size exceeds 10MB limit")
                
                contents = bytearray()
                async for chunk in response.aiter_bytes():
                    contents.extend(chunk)
                    if len(contents) > 10 * 1024 * 1024:
                        raise HTTPException(status_code=400, detail="Image size exceeds 10MB limit during download")
        
        try:
            image = Image.open(io.BytesIO(contents))
        except Exception:
            raise HTTPException(status_code=400, detail="Downloaded file is not a valid image format for PIL")
            
        result = inference_service.predict(image)
        
        logging_service.log_prediction(
            source_type="url",
            image_name=None,
            image_url=request.image_url,
            predicted_label=result["label"],
            confidence=result["confidence"],
            fake_probability=result["fake_probability"],
            real_probability=result["real_probability"],
            model_name=result["model_used"],
            model_version=settings.VERSION,
            processing_time_ms=result["processing_time_ms"]
        )
        
        return PredictResponse(
            label=result["label"],
            confidence=result["confidence"],
            fake_probability=result["fake_probability"],
            real_probability=result["real_probability"],
            model_name=result["model_used"],
            model_version=settings.VERSION,
            processing_time_ms=result["processing_time_ms"]
        )
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request to image URL timed out after 10 seconds")
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Error fetching image from URL: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error processing image URL: {str(e)}")
