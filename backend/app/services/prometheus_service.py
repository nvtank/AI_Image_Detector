"""
Prometheus Metrics Service — Custom Application Metrics
========================================================
Phase 4 Infrastructure: Observability & Monitoring

This module defines all custom Prometheus metrics for the AI Image Detector.
Metrics are exposed at GET /prometheus-metrics (Prometheus scrape endpoint).

Metric Categories:
  1. HTTP Layer       — request counts, latency, error rates
  2. AI Inference     — model latency, prediction distributions, Gemini call stats
  3. Task Queue       — Celery queue depth, task states, processing time
  4. Security         — rate limit hits, failed logins, suspicious requests
  5. Business         — total predictions, fake/real ratio, user activity

Naming Convention: snake_case with prefix "ai_detector_"
All histograms use SLO-aligned bucket boundaries.
"""

import logging
import time
from functools import wraps
from typing import Callable

from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    Info,
    CollectorRegistry,
    REGISTRY,
)

logger = logging.getLogger(__name__)

# ── Application Info ──────────────────────────────────────────────────────────
app_info = Info(
    "ai_detector_app",
    "Application metadata",
)

# ── HTTP Metrics ──────────────────────────────────────────────────────────────

http_requests_total = Counter(
    "ai_detector_http_requests_total",
    "Total number of HTTP requests",
    labelnames=["method", "endpoint", "status_code"],
)

http_request_duration_seconds = Histogram(
    "ai_detector_http_request_duration_seconds",
    "HTTP request latency in seconds",
    labelnames=["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

http_requests_in_flight = Gauge(
    "ai_detector_http_requests_in_flight",
    "Number of HTTP requests currently being processed",
)

# ── AI Inference Metrics ──────────────────────────────────────────────────────

inference_requests_total = Counter(
    "ai_detector_inference_requests_total",
    "Total number of AI inference requests",
    labelnames=["model_type", "result"],  # model_type: local/hybrid/async
)

inference_latency_seconds = Histogram(
    "ai_detector_inference_latency_seconds",
    "AI inference processing time in seconds",
    labelnames=["model_type"],  # local / gemini / hybrid
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0],
)

predictions_by_label = Counter(
    "ai_detector_predictions_by_label_total",
    "Prediction results by label (FAKE/REAL/UNCERTAIN)",
    labelnames=["label", "source"],  # source: local/hybrid
)

gemini_api_calls_total = Counter(
    "ai_detector_gemini_api_calls_total",
    "Total Gemini API calls",
    labelnames=["status"],  # success / error / timeout
)

gemini_api_latency_seconds = Histogram(
    "ai_detector_gemini_api_latency_seconds",
    "Gemini API response latency",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0],
)

hybrid_agreement_total = Counter(
    "ai_detector_hybrid_agreement_total",
    "Hybrid decision agreement status counts",
    labelnames=["agreement_status"],  # agree / disagree / gemini_unavailable / uncertain
)

# ── Task Queue Metrics ────────────────────────────────────────────────────────

celery_tasks_total = Counter(
    "ai_detector_celery_tasks_total",
    "Total Celery tasks by state",
    labelnames=["state"],  # queued / success / failure / retry
)

celery_task_duration_seconds = Histogram(
    "ai_detector_celery_task_duration_seconds",
    "Celery task end-to-end processing time",
    buckets=[1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0, 120.0],
)

celery_queue_depth = Gauge(
    "ai_detector_celery_queue_depth",
    "Number of tasks currently in the Celery queue",
    labelnames=["queue"],  # ai_inference / default
)

# ── Security Metrics ──────────────────────────────────────────────────────────

security_events_total = Counter(
    "ai_detector_security_events_total",
    "Total security events by type",
    labelnames=["event_type", "severity"],
)

rate_limit_hits_total = Counter(
    "ai_detector_rate_limit_hits_total",
    "Total rate limit violations",
    labelnames=["endpoint"],
)

failed_logins_total = Counter(
    "ai_detector_failed_logins_total",
    "Total failed login attempts",
)

blocked_requests_total = Counter(
    "ai_detector_blocked_requests_total",
    "Total requests blocked by security policy (intrusion detection)",
)

# ── Business / Usage Metrics ──────────────────────────────────────────────────

active_users_gauge = Gauge(
    "ai_detector_active_users",
    "Estimated number of users with active sessions (refresh tokens)",
)

upload_size_bytes = Histogram(
    "ai_detector_upload_size_bytes",
    "Size of uploaded images in bytes",
    buckets=[10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000],
)

cloudinary_uploads_total = Counter(
    "ai_detector_cloudinary_uploads_total",
    "Total Cloudinary CDN upload attempts",
    labelnames=["status"],  # success / failure / skipped
)


# ── Helper Decorators ──────────────────────────────────────────────────────────

def track_inference_latency(model_type: str):
    """Decorator to measure and record inference latency."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed = time.perf_counter() - start
                inference_latency_seconds.labels(model_type=model_type).observe(elapsed)
                return result
            except Exception:
                elapsed = time.perf_counter() - start
                inference_latency_seconds.labels(model_type=model_type).observe(elapsed)
                raise
        return wrapper
    return decorator


def track_gemini_call(status: str = "success"):
    """Record a Gemini API call."""
    gemini_api_calls_total.labels(status=status).inc()


def record_prediction(label: str, source: str = "hybrid"):
    """Record a prediction label outcome."""
    predictions_by_label.labels(label=label, source=source).inc()


def record_hybrid_agreement(agreement_status: str):
    """Record hybrid decision agreement status."""
    hybrid_agreement_total.labels(agreement_status=agreement_status).inc()


def record_security_event(event_type: str, severity: str = "WARNING"):
    """Record a security audit event in Prometheus."""
    security_events_total.labels(event_type=event_type, severity=severity).inc()

    # Also increment specific counters for alerting
    if event_type == "RATE_LIMIT_EXCEEDED":
        rate_limit_hits_total.labels(endpoint="unknown").inc()
    elif event_type == "LOGIN_FAILED":
        failed_logins_total.inc()
    elif event_type == "SUSPICIOUS_REQUEST":
        blocked_requests_total.inc()


def record_celery_task(state: str, duration_seconds: float = None):
    """Record Celery task lifecycle event."""
    celery_tasks_total.labels(state=state).inc()
    if duration_seconds is not None and state in ("success", "failure"):
        celery_task_duration_seconds.observe(duration_seconds)


def update_queue_depth(queue_name: str, depth: int):
    """Update Celery queue depth gauge."""
    celery_queue_depth.labels(queue=queue_name).set(depth)
