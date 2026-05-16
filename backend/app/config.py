from pydantic_settings import BaseSettings, SettingsConfigDict
import os

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

settings = Settings()
