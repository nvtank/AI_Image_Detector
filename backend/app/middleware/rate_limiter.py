"""
Rate Limiting Middleware using SlowAPI
=====================================
Protects the API against brute force and DDoS attacks.
Exposes a `limiter` instance that can be used as decorators on route functions.
Also registers a handler to catch RateLimitExceeded exceptions, logging them to
the security audit log and returning a standard JSON response.
"""

import logging
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.services.security_audit_service import security_audit_service

logger = logging.getLogger(__name__)

# Initialize Limiter using IP address as the default key
limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=False
)


async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit violations.
    Logs the event to the database and returning a structured JSON response.
    """
    client_ip = request.client.host if request.client else "unknown"
    endpoint = request.url.path
    method = request.method
    
    # Extract user ID if already parsed in request state (if any)
    user_id = None
    if hasattr(request.state, "user") and request.state.user:
        user_id = request.state.user.get("id")
        
    # Log the event to Security Audit DB
    try:
        security_audit_service.log_event(
            event_type="RATE_LIMIT_EXCEEDED",
            ip_address=client_ip,
            endpoint=endpoint,
            method=method,
            user_id=user_id,
            details=f"Rate limit exceeded: {exc.detail}",
            severity="WARNING",
            auto_action="rate_limited"
        )
    except Exception as e:
        logger.error(f"[RateLimiter] Failed to log rate limit event: {e}")

    # Standard slowapi default handler execution for HTTP headers
    response = _rate_limit_exceeded_handler(request, exc)
    
    # Return structured JSON response
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
            "error": "rate_limited",
            "limit": exc.detail
        },
        headers=dict(response.headers)
    )

def setup_rate_limiting(app: FastAPI):
    """
    Registers the slowapi Limiter and exception handler to the FastAPI app.
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
    logger.info("[RateLimiter] Rate limiting successfully initialized")
