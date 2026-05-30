"""
WebSocket Connection Manager — Real-Time Notification Hub
=========================================================
Phase 5 Infrastructure: Real-Time Bidirectional Communication

Architecture:
  FastAPI WebSocket endpoint ← authenticated via JWT access token in query param
  ConnectionManager maintains:
    - user_connections: Dict[user_id, List[WebSocket]]   (multi-tab support)
    - admin_connections: List[WebSocket]                  (admin broadcast channel)

Message Protocol (JSON):
  Every message sent has:
    { "type": str, "data": dict, "timestamp": ISO8601 }

  Inbound (client → server):
    { "type": "ping" }                 → server replies with "pong"
    { "type": "subscribe_task", "task_id": str }
    { "type": "unsubscribe_task", "task_id": str }

  Outbound (server → client):
    { "type": "task_progress",  "data": { task_id, stage, label, percent } }
    { "type": "task_complete",  "data": { task_id, result } }
    { "type": "task_failed",    "data": { task_id, error } }
    { "type": "security_alert", "data": { event_type, severity, details } }  ← admin only
    { "type": "system_health",  "data": { status, timestamp } }
    { "type": "pong",           "data": {} }

Broadcast helpers (called from Celery tasks, security audit, etc.):
    ws_manager.send_to_user(user_id, message_type, data)
    ws_manager.broadcast_to_admins(message_type, data)
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Central WebSocket connection registry and message dispatcher.
    Thread-safe for concurrent async access within a single process.
    
    Limitation: In a multi-worker deployment, connections are process-local.
    For multi-instance scaling, replace with Redis Pub/Sub as the message bus.
    """

    def __init__(self):
        # user_id → list of open WebSocket connections (multi-tab)
        self._user_connections: Dict[int, List[WebSocket]] = {}
        # admin connections for broadcast
        self._admin_connections: List[WebSocket] = []
        # task_id → set of user_ids subscribed to that task's progress
        self._task_subscribers: Dict[str, Set[int]] = {}

    # ── Connection Lifecycle ──────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, user_id: int, is_admin: bool = False):
        """Accept a new WebSocket connection and register it."""
        await websocket.accept()

        if user_id not in self._user_connections:
            self._user_connections[user_id] = []
        self._user_connections[user_id].append(websocket)

        if is_admin and websocket not in self._admin_connections:
            self._admin_connections.append(websocket)

        logger.info(
            f"[WS] User {user_id} connected. "
            f"Total users: {len(self._user_connections)}, "
            f"Total admins: {len(self._admin_connections)}"
        )

        # Send welcome ping
        await self._send_to_socket(websocket, "connected", {
            "user_id": user_id,
            "is_admin": is_admin,
            "message": "WebSocket connection established",
        })

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a disconnected WebSocket from all registries."""
        if user_id in self._user_connections:
            try:
                self._user_connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]

        if websocket in self._admin_connections:
            self._admin_connections.remove(websocket)

        # Remove from task subscriptions
        for task_subscribers in self._task_subscribers.values():
            task_subscribers.discard(user_id)

        logger.info(f"[WS] User {user_id} disconnected. Remaining users: {len(self._user_connections)}")

    # ── Task Subscription ─────────────────────────────────────────────────

    def subscribe_to_task(self, user_id: int, task_id: str):
        """Subscribe a user to receive progress updates for a specific task."""
        if task_id not in self._task_subscribers:
            self._task_subscribers[task_id] = set()
        self._task_subscribers[task_id].add(user_id)

    def unsubscribe_from_task(self, user_id: int, task_id: str):
        """Unsubscribe a user from a task's progress updates."""
        if task_id in self._task_subscribers:
            self._task_subscribers[task_id].discard(user_id)
            if not self._task_subscribers[task_id]:
                del self._task_subscribers[task_id]

    # ── Message Sending ───────────────────────────────────────────────────

    async def _send_to_socket(self, websocket: WebSocket, msg_type: str, data: dict):
        """Send a JSON message to a single WebSocket. Handles stale connections silently."""
        try:
            payload = {
                "type": msg_type,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await websocket.send_text(json.dumps(payload))
        except Exception as e:
            logger.debug(f"[WS] Send failed (stale socket): {e}")

    async def send_to_user(self, user_id: int, msg_type: str, data: dict):
        """Send a message to ALL open tabs of a specific user."""
        sockets = self._user_connections.get(user_id, [])
        if not sockets:
            return  # User not connected — message dropped (polling is fallback)

        dead_sockets = []
        for ws in sockets:
            try:
                await self._send_to_socket(ws, msg_type, data)
            except Exception:
                dead_sockets.append(ws)

        # Clean up dead sockets
        for ws in dead_sockets:
            try:
                self._user_connections[user_id].remove(ws)
            except (ValueError, KeyError):
                pass

    async def broadcast_to_admins(self, msg_type: str, data: dict):
        """Broadcast a message to all connected admin users (security alerts, system events)."""
        dead = []
        for ws in self._admin_connections:
            try:
                await self._send_to_socket(ws, msg_type, data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self._admin_connections:
                self._admin_connections.remove(ws)

    async def push_task_progress(self, task_id: str, user_id: int, stage: str, label: str, percent: int):
        """Push Celery task progress update to the task owner."""
        await self.send_to_user(user_id, "task_progress", {
            "task_id": task_id,
            "stage": stage,
            "label": label,
            "percent": percent,
        })

    async def push_task_complete(self, task_id: str, user_id: int, result: dict):
        """Push task completion with full result to owner."""
        await self.send_to_user(user_id, "task_complete", {
            "task_id": task_id,
            "result": result,
        })
        # Clean up subscription
        self.unsubscribe_from_task(user_id, task_id)

    async def push_task_failed(self, task_id: str, user_id: int, error: str):
        """Push task failure notification to owner."""
        await self.send_to_user(user_id, "task_failed", {
            "task_id": task_id,
            "error": error,
        })
        self.unsubscribe_from_task(user_id, task_id)

    async def push_security_alert(self, event_type: str, severity: str, details: str, ip_address: str = None):
        """Broadcast a security alert to ALL connected admin users."""
        await self.broadcast_to_admins("security_alert", {
            "event_type": event_type,
            "severity": severity,
            "details": details,
            "ip_address": ip_address,
        })

    # ── Stats ─────────────────────────────────────────────────────────────

    def get_connection_stats(self) -> dict:
        return {
            "connected_users": len(self._user_connections),
            "connected_admins": len(self._admin_connections),
            "total_connections": sum(len(v) for v in self._user_connections.values()),
            "active_task_subscriptions": len(self._task_subscribers),
        }


# ── Singleton manager (process-local) ────────────────────────────────────────
ws_manager = ConnectionManager()
