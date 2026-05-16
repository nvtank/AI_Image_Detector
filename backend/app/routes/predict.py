from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas import PredictResponse
from app.services.inference_service import inference_service
from app.config import settings
from PIL import Image
import io

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
