"""
Security Headers Middleware
==========================
Hardens the application against typical web vulnerabilities such as Clickjacking,
MIME-sniffing, XSS, and unauthorized cross-origin requests.
Adds industry-standard HTTP security headers to all responses.
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, FastAPI

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that injects HTTP security headers into every response.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Prevent Clickjacking (Clickjacking Protection)
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME-type sniffing (MIME Sniffing Protection)
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Enable XSS protection filter in older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Strictly control referrer information passed in headers
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Enable HTTP Strict Transport Security (HSTS) in HTTPS environments
        # Tells browser to only connect via HTTPS for the next 1 year
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Content Security Policy (CSP)
        # Prevents loading unauthorized external scripts, styles, frames
        csp_policies = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://res.cloudinary.com",
            "connect-src 'self' ws: wss: http://localhost:8000 https://api.cloudinary.com",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_policies)
        
        # Permissions Policy - restricts access to hardware APIs (geolocation, camera, mic)
        permissions = [
            "camera=()",
            "microphone=()",
            "geolocation=()",
            "payment=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions)
        
        return response

def setup_security_headers(app: FastAPI):
    """
    Registers the SecurityHeadersMiddleware to the FastAPI application.
    """
    app.add_middleware(SecurityHeadersMiddleware)
    logger.info("[SecurityHeaders] Security headers middleware successfully registered")
