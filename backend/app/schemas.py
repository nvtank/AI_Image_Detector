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

