from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import health

def get_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )

    # Set up CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    application.include_router(health.router)
    
    # Placeholders for future routers (uncomment when implemented)
    # from app.routes import predict, models, metrics
    # application.include_router(predict.router, prefix=settings.API_V1_STR)
    # application.include_router(models.router, prefix=settings.API_V1_STR)
    # application.include_router(metrics.router, prefix=settings.API_V1_STR)

    return application

app = get_application()
