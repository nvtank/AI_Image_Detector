from pydantic import BaseModel, EmailStr
from typing import Optional

# ---- Health ----
class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str

# ---- Auth ----
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str

class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None  # user_id as string

# ---- Predict ----
class PredictUrlRequest(BaseModel):
    image_url: str

class PredictResponse(BaseModel):
    label: str
    confidence: float
    fake_probability: float
    real_probability: float
    model_name: str
    model_version: str
    processing_time_ms: int
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    cloudinary_public_id: Optional[str] = None
    cloudinary_warning: Optional[str] = None

class ExplainResponse(BaseModel):
    label: str
    confidence: float
    heatmap_base64: str
    processing_time_ms: int

# ---- History ----
class HistoryItemResponse(BaseModel):
    id: int
    source_type: str
    image_name: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    label: str
    confidence: float
    fake_probability: float
    real_probability: float
    model_name: str
    model_version: str
    processing_time_ms: int
    created_at: str

# ---- Legacy alias ----
class PredictionLog(HistoryItemResponse):
    pass

# ---- Models / Metrics ----
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
