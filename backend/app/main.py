import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

logger = logging.getLogger(__name__)


def get_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Validate Cloudinary config at startup (non-fatal warning if disabled)
    try:
        settings.check_cloudinary()
    except ValueError as e:
        logger.error(f"[Config] {e}")
        raise

    # Include routers
    from app.routes import health, predict, history, models, metrics, auth

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(predict.router)
    application.include_router(history.router)
    application.include_router(models.router)
    application.include_router(metrics.router)

    return application


app = get_application()
