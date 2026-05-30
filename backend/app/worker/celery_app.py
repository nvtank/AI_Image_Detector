"""
Celery Application — Async Task Queue Configuration
====================================================
Phase 3 Infrastructure: Asynchronous AI Inference Pipeline

Architecture:
  [FastAPI] → upload file → Cloudinary
           → enqueue task_id into Redis
           → return 202 Accepted + task_id immediately (no blocking)
           
  [Redis Queue] → [Celery Worker Process]
                      → download image from Cloudinary URL
                      → run PyTorch local model inference
                      → call Gemini Multimodal API
                      → combine results (hybrid decision)
                      → log to SQLite
                      → update task state to SUCCESS

  [Frontend] → poll GET /tasks/{task_id} every 2s
             → display real-time animated progress stages
             → render full result card on SUCCESS

Queue Design:
  - "ai_inference" queue: high-priority GPU tasks (predict-hybrid)
  - "default" queue: general lower-priority tasks
  
Storage backend:
  - Broker: Redis (for job queueing)
  - Result Backend: Redis (for task state & result retrieval)
  - Fallback: If Redis unavailable → use in-memory (dev mode)
"""

import logging
from celery import Celery
from kombu import Queue

logger = logging.getLogger(__name__)

# ── Redis connection URI ───────────────────────────────────────────────────
# Override via REDIS_URL env var in production
import os
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── Celery App ─────────────────────────────────────────────────────────────
celery_app = Celery(
    "ai_detector",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.worker.tasks"],  # Auto-discover tasks
)

# ── Celery Configuration ───────────────────────────────────────────────────
celery_app.conf.update(
    # Task serialization — JSON is safe, readable, and debuggable
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    
    # Timezone
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    
    # Task result TTL — keep results for 24 hours (for polling)
    result_expires=86400,
    
    # Named queues with priorities
    task_queues=(
        Queue("ai_inference", routing_key="ai_inference"),  # Heavy GPU tasks
        Queue("default", routing_key="default"),             # Light tasks
    ),
    task_default_queue="ai_inference",
    task_default_routing_key="ai_inference",
    
    # Worker concurrency — set low since AI inference is CPU/GPU heavy
    # Each worker process should handle one task at a time
    worker_concurrency=2,
    
    # Prefetch: take 1 task at a time (prevents memory overload with large images)
    worker_prefetch_multiplier=1,
    
    # Task time limits
    task_soft_time_limit=120,  # 2 minutes — sends SoftTimeLimitExceeded
    task_time_limit=150,       # 2.5 minutes hard limit
    
    # Retry policy for transient errors
    task_acks_late=True,  # Acknowledge task only after completion (prevents loss)
    task_reject_on_worker_lost=True,
    
    # Track task state (PENDING → STARTED → SUCCESS/FAILURE)
    task_track_started=True,
    
    # Result compression for large Gemini responses
    result_compression="zlib",
    
    # Broker connection retry
    broker_connection_retry_on_startup=True,
)

logger.info(f"[Celery] Initialized with broker: {REDIS_URL}")
