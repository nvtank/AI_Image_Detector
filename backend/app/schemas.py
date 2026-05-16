from pydantic import BaseModel

class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str

class PredictResponse(BaseModel):
    label: str
    confidence: float
    fake_probability: float
    real_probability: float
    model_name: str
    model_version: str
    processing_time_ms: int

class PredictUrlRequest(BaseModel):
    image_url: str

class PredictionLog(PredictResponse):
    id: int
    source_type: str
    image_name: str | None = None
    image_url: str | None = None
    created_at: str

