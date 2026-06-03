from pydantic_settings import BaseSettings, SettingsConfigDict
import os
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Image Detector API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    # Model config
    MODEL_WEIGHTS_PATH: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "weights", "best_model.pt")
    MODEL_NAME: str = "efficientnetv2_rw_s"
    MODEL_NUM_CLASSES: int = 2
    INPUT_SIZE: int = 224

    # Database Config
    DATABASE_PATH: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "predictions.db")

    # JWT Auth - Dual Token System
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    # Access Token: short-lived (15 minutes) — stored in memory/Authorization header
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    # Refresh Token: long-lived (7 days) — stored in DB, used to renew access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Separate secret for refresh tokens (defense-in-depth)
    JWT_REFRESH_SECRET_KEY: str = "change-refresh-secret-in-production"

    # RBAC - Admin users (comma-separated email list)
    ADMIN_EMAILS: str = ""

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # SMTP Config (Forgot Password)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@ai-image-detector.com"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "ai-image-detector/uploads"
    ENABLE_CLOUDINARY_UPLOAD: bool = False

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 10

    # Gemini Config
    GEMINI_API_KEY: str = ""
    ENABLE_GEMINI_ANALYSIS: bool = True
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        protected_namespaces=()
    )

    def check_cloudinary(self):
        """Call this at startup to validate Cloudinary config when enabled."""
        if self.ENABLE_CLOUDINARY_UPLOAD:
            missing = []
            if not self.CLOUDINARY_CLOUD_NAME:
                missing.append("CLOUDINARY_CLOUD_NAME")
            if not self.CLOUDINARY_API_KEY:
                missing.append("CLOUDINARY_API_KEY")
            if not self.CLOUDINARY_API_SECRET:
                missing.append("CLOUDINARY_API_SECRET")
            if missing:
                raise ValueError(
                    f"ENABLE_CLOUDINARY_UPLOAD=true but missing required env vars: {', '.join(missing)}"
                )
        return True

    def check_gemini(self):
        """Log warning if Gemini enabled but API key is missing."""
        if self.ENABLE_GEMINI_ANALYSIS and not self.GEMINI_API_KEY:
            logger.warning(
                "⚠️ ENABLE_GEMINI_ANALYSIS is true but GEMINI_API_KEY is missing. "
                "Hybrid analysis will fall back to local-only predictions."
            )
        return True

settings = Settings()
settings.check_gemini()
