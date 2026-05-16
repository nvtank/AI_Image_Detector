import torch
import torch.nn.functional as F
import time
from PIL import Image
from app.core.model_registry import model_registry
from app.services.preprocessing import preprocess_image
from app.config import settings

class InferenceService:
    def __init__(self):
        # Assumes alphabetical sorting: FAKE=0, REAL=1
        self.labels = ["FAKE", "REAL"]

    def predict(self, image: Image.Image):
        # 1. Preprocess
        start_time = time.time()
        tensor_batch = preprocess_image(image)
        
        # 2. Get Model
        model, device = model_registry.get_model()
        tensor_batch = tensor_batch.to(device)
        
        # 3. Inference
        with torch.no_grad():
            outputs = model(tensor_batch)
            probabilities = F.softmax(outputs, dim=1).cpu().numpy()[0]
            
        # 4. Post-process
        fake_prob = float(probabilities[0])
        real_prob = float(probabilities[1])
        
        predicted_idx = int(torch.argmax(outputs, dim=1).item())
        label = self.labels[predicted_idx]
        confidence = float(probabilities[predicted_idx])
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "label": label,
            "confidence": confidence,
            "fake_probability": fake_prob,
            "real_probability": real_prob,
            "processing_time_ms": processing_time_ms,
            "model_used": settings.MODEL_NAME
        }

inference_service = InferenceService()
