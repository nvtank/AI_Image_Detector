from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Literal

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
    role: Literal["user", "admin"] = "user"

class AuthResponse(BaseModel):
    """
    Response returned on login/signup/refresh.
    Both access_token (short-lived) and refresh_token (long-lived) are included.
    Frontend should store refresh_token securely (memory or httpOnly cookie preferred).
    """
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # access token TTL in seconds (15 min = 900s)

class RefreshTokenRequest(BaseModel):
    """Request body for POST /auth/refresh and POST /auth/logout."""
    refresh_token: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None  # user_id as string
    role: Optional[str] = None
    token_type: Optional[str] = None

# ---- Predict ----
class PredictUrlRequest(BaseModel):
    image_url: str

class PredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
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
    model_config = ConfigDict(protected_namespaces=())
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
    
    # Hybrid Fields
    local_predicted_label: Optional[str] = None
    local_confidence: Optional[float] = None
    gemini_predicted_label: Optional[str] = None
    gemini_confidence_level: Optional[str] = None
    gemini_reasoning_summary: Optional[str] = None
    gemini_visual_signals: Optional[list[str]] = None
    gemini_limitations: Optional[str] = None
    agreement_status: Optional[str] = None
    final_decision: Optional[str] = None
    used_gemini: Optional[bool] = None

# ---- Legacy alias ----
class PredictionLog(HistoryItemResponse):
    pass

# ---- Gemini & Hybrid prediction schemas ----
class GeminiAnalysisResponse(BaseModel):
    predicted_label: str  # "FAKE", "REAL", "UNCERTAIN"
    confidence_score: float
    confidence_level: str  # "high", "medium", "low"
    evidence_for_fake: list[str]
    evidence_for_real: list[str]
    uncertainty_reasons: list[str]
    reasoning_summary: str
    recommendation: str
    should_trust_result: bool
    visual_signals: Optional[list[str]] = []
    limitations: Optional[str] = None
    error: Optional[bool] = None

class LocalModelResult(BaseModel):
    predicted_label: str
    confidence: float
    fake_probability: float
    real_probability: float
    model_name: str
    processing_time_ms: int

class HybridDecision(BaseModel):
    final_decision: str  # "FAKE", "REAL", "UNCERTAIN"
    agreement_status: str  # "agree", "disagree", "gemini_unavailable"
    recommendation: str

class HybridPredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    final_decision: str
    agreement_status: str
    local_model: LocalModelResult
    gemini_analysis: Optional[GeminiAnalysisResponse] = None
    recommendation: str
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    cloudinary_warning: Optional[str] = None

# ---- Models / Metrics ----
class AvailableModel(BaseModel):
    name: str
    role: str
    clean_f1: float
    robust_avg_f1: float

class ModelsInfoResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    active_model: str
    model_version: str
    available_models: list[AvailableModel]

class MetricsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_comparison: list[dict]
    robustness_results: list[dict]
    training_history_summary: list[dict]
