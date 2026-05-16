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

    # JWT Auth
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "ai-image-detector/uploads"
    ENABLE_CLOUDINARY_UPLOAD: bool = False

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

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

settings = Settings()
