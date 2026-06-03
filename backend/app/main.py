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

    # ── Security Middleware (must be added BEFORE CORS) ──
    # Order matters: SlowAPI → SecurityHeaders → RequestLogging → Prometheus → CORS
    from app.middleware.rate_limiter import setup_rate_limiting
    from app.middleware.security_headers import setup_security_headers
    from app.middleware.request_logging import setup_request_logging
    
    setup_rate_limiting(application)
    setup_security_headers(application)
    setup_request_logging(application)

    # ── Phase 4: Prometheus Observability ──
    from app.middleware.prometheus_middleware import setup_prometheus
    setup_prometheus(application)


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
    from app.routes.security import router as security_router
    from app.routes.tasks import router as tasks_router
    from app.routes.websocket import router as ws_router
    from app.routes.payment import router as payment_router
    from app.routes.admin import router as admin_router

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(predict.router)
    application.include_router(history.router)
    application.include_router(models.router)
    application.include_router(metrics.router)
    application.include_router(security_router)
    application.include_router(tasks_router)
    application.include_router(ws_router)  # Phase 5: WebSocket
    application.include_router(payment_router)  # Phase 6: payOS Payment
    application.include_router(admin_router)   # Admin management

    return application


app = get_application()
