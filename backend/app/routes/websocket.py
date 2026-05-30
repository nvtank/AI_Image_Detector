"""
WebSocket API Routes — Phase 5: Real-Time Notifications
=======================================================
Endpoints:
  WS  /ws                        → Main user notification channel (auth required)
  WS  /ws/admin                  → Admin-only broadcast channel (admin role required)
  GET /ws/stats                  → Connection statistics (admin only)

Authentication via JWT access token as query parameter:
  ws://localhost:8000/ws?token=<access_token>

Standard WebSocket headers cannot carry Bearer tokens, so the token is
passed as a URL query param instead. The token is validated on connection
upgrade — if invalid, the connection is immediately closed with code 4001.

Message Protocol:
  Client sends:
    { "type": "ping" }
    { "type": "subscribe_task", "task_id": "..." }
    { "type": "unsubscribe_task", "task_id": "..." }

  Server sends:
    { "type": "pong" | "connected" | "task_progress" | "task_complete" | ... }
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi import HTTPException, status

from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: Optional[str]) -> Optional[dict]:
    """
    Authenticate a WebSocket connection via JWT access token (query param).
    Returns user dict if valid, None if invalid.
    """
    if not token:
        return None
    try:
        from app.services.auth_service import decode_access_token, get_user_by_id, resolve_role
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = int(payload.get("sub", 0))
        user = get_user_by_id(user_id)
        if not user:
            return None
        user["role"] = resolve_role(user["email"])
        return user
    except Exception as e:
        logger.debug(f"[WS Auth] Token validation failed: {e}")
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token"),
):
    """
    Main WebSocket endpoint for authenticated users.
    Receives real-time notifications:
      - Task progress updates (Celery pipeline stages)
      - Task completion with full result
      - Personal security alerts
      
    Authentication: ?token=<access_token>
    Close codes:
      4001 = Unauthorized (invalid/missing token)
      4003 = Forbidden
      1000 = Normal closure
    """
    # ── Authenticate ──────────────────────────────────────────────────────
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized: invalid or missing token")
        logger.warning(f"[WS] Rejected unauthenticated connection from {websocket.client}")
        return

    user_id = user["id"]
    is_admin = user.get("role") == "admin"

    # ── Connect ───────────────────────────────────────────────────────────
    await ws_manager.connect(websocket, user_id, is_admin=is_admin)

    try:
        while True:
            # Wait for messages from the client
            raw = await websocket.receive_text()

            try:
                msg = json.loads(raw)
                msg_type = msg.get("type", "")
            except json.JSONDecodeError:
                logger.debug(f"[WS] User {user_id} sent malformed JSON: {raw[:100]}")
                continue

            # ── Handle client messages ────────────────────────────────────
            if msg_type == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "data": {"user_id": user_id},
                    "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
                }))

            elif msg_type == "subscribe_task":
                task_id = msg.get("task_id")
                if task_id:
                    ws_manager.subscribe_to_task(user_id, task_id)
                    logger.info(f"[WS] User {user_id} subscribed to task {task_id}")

            elif msg_type == "unsubscribe_task":
                task_id = msg.get("task_id")
                if task_id:
                    ws_manager.unsubscribe_from_task(user_id, task_id)

            elif msg_type == "get_stats" and is_admin:
                stats = ws_manager.get_connection_stats()
                await websocket.send_text(json.dumps({
                    "type": "stats",
                    "data": stats,
                    "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
                }))

            else:
                logger.debug(f"[WS] Unknown message type from user {user_id}: {msg_type}")

    except WebSocketDisconnect:
        logger.info(f"[WS] User {user_id} disconnected (normal)")
    except Exception as e:
        logger.error(f"[WS] Error for user {user_id}: {e}", exc_info=True)
    finally:
        ws_manager.disconnect(websocket, user_id)


@router.get("/ws/stats")
async def get_ws_stats(current_user: dict = Depends(__import__("app.core.auth", fromlist=["require_admin"]).require_admin)):
    """Return WebSocket connection statistics. Admin only."""
    return ws_manager.get_connection_stats()
