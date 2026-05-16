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

class ExplainResponse(BaseModel):
    label: str
    confidence: float
    heatmap_base64: str
    processing_time_ms: int

class PredictUrlRequest(BaseModel):
    image_url: str

class PredictionLog(PredictResponse):
    id: int
    source_type: str
    image_name: str | None = None
    image_url: str | None = None
    created_at: str

class AvailableModel(BaseModel):
    name: str
    role: str
    clean_f1: float
    robust_avg_f1: float

class ModelsInfoResponse(BaseModel):
    active_model: str
    model_version: str
    available_models: list[AvailableModel]

class MetricsResponse(BaseModel):
    model_comparison: list[dict]
    robustness_results: list[dict]
    training_history_summary: list[dict]

