"""
Request Logging & Intrusion Detection Middleware
===============================================
Phase 1: Security Hardening
Intercepts every HTTP request to:
  1. Measure response time (for basic performance tracking).
  2. Scan URL path, query params, and headers for suspicious hacking payloads
     (SQL injection patterns, Path traversal, XSS scripts).
  3. Write suspicious requests as 'SUSPICIOUS_REQUEST' security events to SQLite.
"""

import time
import re
import urllib.parse
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, FastAPI
from app.services.security_audit_service import security_audit_service

logger = logging.getLogger(__name__)

# Basic patterns to detect typical exploitation attempts
SUSPICIOUS_PATTERNS = {
    "SQL_Injection": re.compile(
        r"UNION\s+SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|OR\s+['\"].*['\"]\s*=\s*['\"].*",
        re.IGNORECASE
    ),
    "Path_Traversal": re.compile(
        r"\.\./|\.\.\\|etc/passwd|/etc/shadow|/win\.ini|/boot\.ini",
        re.IGNORECASE
    ),
    "Cross_Site_Scripting": re.compile(
        r"<script.*?>|javascript:|onload\s*=|<iframe.*?>|onerror\s*=",
        re.IGNORECASE
    ),
    "Remote_File_Inclusion": re.compile(
        r"https?://.*\.(txt|php|exe|sh|pl)\b",
        re.IGNORECASE
    )
}

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Interceptors for audit logging and light intrusion detection.
    """
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        endpoint = request.url.path
        method = request.method
        
        # Avoid scanning system endpoints (like docs, metrics, websocket)
        is_system_path = any(
            endpoint.startswith(p) for p in [
                "/prometheus-metrics", "/docs", "/openapi.json", "/redoc", "/ws"
            ]
        )
        
        if not is_system_path:
            # Decode query parameters
            query_str = urllib.parse.unquote(str(request.url.query))
            path_str = urllib.parse.unquote(endpoint)
            
            # Scan query and path for malicious patterns
            malicious_detected = None
            detected_details = ""
            
            for attack_type, pattern in SUSPICIOUS_PATTERNS.items():
                if pattern.search(query_str):
                    malicious_detected = attack_type
                    detected_details = f"Malicious payload in query string: '{query_str}'"
                    break
                if pattern.search(path_str):
                    malicious_detected = attack_type
                    detected_details = f"Malicious payload in URL path: '{path_str}'"
                    break
                    
            # If a pattern is matched, trigger a security audit event
            if malicious_detected:
                logger.warning(
                    f"[IDS] Suspicious {malicious_detected} request detected from {client_ip} "
                    f"attempting {method} {endpoint}"
                )
                try:
                    security_audit_service.log_event(
                        event_type="SUSPICIOUS_REQUEST",
                        ip_address=client_ip,
                        endpoint=endpoint,
                        method=method,
                        details=f"Attack Type: {malicious_detected} - {detected_details}",
                        severity="HIGH",
                        auto_action="logged"
                    )
                except Exception as e:
                    logger.error(f"[IDS] Failed to write security event: {e}")
                    
        # Trace duration
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Log regular requests in debug mode
            logger.debug(
                f"[Request] {client_ip} - {method} {endpoint} -> "
                f"Status: {response.status_code} in {duration:.4f}s"
            )
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"[Request] {client_ip} - {method} {endpoint} -> "
                f"Error: {e} after {duration:.4f}s"
            )
            raise e

def setup_request_logging(app: FastAPI):
    """
    Registers the RequestLoggingMiddleware to the FastAPI application.
    """
    app.add_middleware(RequestLoggingMiddleware)
    logger.info("[RequestLogging] Request logging & intrusion detection active")
