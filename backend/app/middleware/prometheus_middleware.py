"""
Prometheus Metrics Middleware
==============================
Intercepts every HTTP request to automatically record:
  - Request count (by method, endpoint, status code)
  - Request latency histogram
  - In-flight requests gauge

Uses normalized endpoint paths (strips IDs) to prevent label cardinality explosion.
Example: /tasks/abc-123-xyz → /tasks/{task_id}
"""

import re
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, FastAPI
from starlette.routing import Match

logger = logging.getLogger(__name__)

# Patterns to normalize dynamic path segments into placeholder labels
# Prevents cardinality explosion in Prometheus (one label per unique UUID/ID)
NORMALIZE_PATTERNS = [
    (re.compile(r"/tasks/[a-f0-9\-]{8,}"), "/tasks/{task_id}"),
    (re.compile(r"/users/\d+"), "/users/{user_id}"),
    (re.compile(r"/history/\d+"), "/history/{id}"),
]


def _normalize_path(path: str) -> str:
    """Replace dynamic path segments with placeholder labels."""
    for pattern, replacement in NORMALIZE_PATTERNS:
        path = pattern.sub(replacement, path)
    return path


class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware that instruments all HTTP requests with Prometheus metrics.
    Should be registered AFTER security middleware but BEFORE route handlers.
    """

    async def dispatch(self, request: Request, call_next):
        # Skip Prometheus scrape endpoint itself to avoid self-instrumentation noise
        if request.url.path == "/prometheus-metrics":
            return await call_next(request)

        # Import here to avoid circular imports at module load time
        from app.services.prometheus_service import (
            http_requests_total,
            http_request_duration_seconds,
            http_requests_in_flight,
        )

        path = _normalize_path(request.url.path)
        method = request.method
        start = time.perf_counter()

        http_requests_in_flight.inc()
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
        except Exception as exc:
            status_code = "500"
            raise exc
        finally:
            duration = time.perf_counter() - start
            http_requests_in_flight.dec()
            http_requests_total.labels(method=method, endpoint=path, status_code=status_code).inc()
            http_request_duration_seconds.labels(method=method, endpoint=path).observe(duration)

        return response


def setup_prometheus(app: FastAPI):
    """
    Register Prometheus middleware and the /prometheus-metrics scrape endpoint.
    Called from main.py during application setup.
    """
    from fastapi import Response
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from app.services.prometheus_service import app_info
    from app.config import settings

    # Set app info labels
    app_info.info({
        "version": settings.VERSION,
        "service": "ai-image-detector-backend",
        "environment": "production",
    })

    # Register the middleware
    app.add_middleware(PrometheusMetricsMiddleware)

    # Register the scrape endpoint
    @app.get("/prometheus-metrics", include_in_schema=False, tags=["monitoring"])
    async def prometheus_metrics():
        """
        Prometheus scrape endpoint.
        Returns all metrics in the Prometheus text exposition format.
        This endpoint is NOT authenticated — Prometheus should be on an internal network only.
        In production: restrict access via Nginx to the Prometheus server IP.
        """
        data = generate_latest()
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)

    logger.info("[Prometheus] Metrics middleware registered. Scrape endpoint: /prometheus-metrics")
