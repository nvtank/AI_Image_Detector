"""
Security Audit Logging Service.
Records security-related events (rate limiting, suspicious requests, failed logins, etc.)
to a dedicated SQLite table for monitoring and forensic analysis.

This service is used by:
- Rate limiting middleware (records 429 events)
- Request logging middleware (records suspicious patterns)
- Auth routes (records failed login attempts)
- Admin dashboard (reads audit logs for display)
"""

import sqlite3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)


class SecurityAuditService:
    def __init__(self):
        self.db_path = settings.DATABASE_PATH
        self._init_audit_table()

    def _get_connection(self):
        import os
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_audit_table(self):
        """Create the security_audit_logs table if it doesn't exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS security_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    ip_address TEXT,
                    endpoint TEXT,
                    method TEXT,
                    user_id INTEGER,
                    details TEXT,
                    severity TEXT DEFAULT 'INFO',
                    auto_action TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Index for fast queries by event_type and time
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_audit_event_type 
                ON security_audit_logs(event_type)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_audit_created_at 
                ON security_audit_logs(created_at)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_audit_severity 
                ON security_audit_logs(severity)
            ''')
            conn.commit()
            logger.info("[Security] Audit log table initialized")

    def log_event(
        self,
        event_type: str,
        ip_address: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        severity: str = "INFO",
        auto_action: Optional[str] = None,
    ):
        """
        Record a security event to the audit log.
        Also emits corresponding Prometheus metrics for real-time alerting.
        """
        try:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO security_audit_logs 
                    (event_type, ip_address, endpoint, method, user_id, details, severity, auto_action, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (event_type, ip_address, endpoint, method, user_id, details, severity, auto_action, now))
                conn.commit()

            # ── Emit Prometheus metrics ────────────────────────────────────
            try:
                from app.services.prometheus_service import record_security_event
                record_security_event(event_type=event_type, severity=severity)
            except Exception:
                pass  # Never let metric recording crash the audit log

            # ── Phase 5: Push real-time alert to admin WebSocket ──────────
            # Only push HIGH/CRITICAL events to avoid alert fatigue
            if severity in ("HIGH", "CRITICAL"):
                try:
                    import asyncio
                    from app.services.ws_manager import ws_manager
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # Schedule as async task if inside async context
                        asyncio.ensure_future(ws_manager.push_security_alert(
                            event_type=event_type,
                            severity=severity,
                            details=details or "",
                            ip_address=ip_address,
                        ))
                    else:
                        loop.run_until_complete(ws_manager.push_security_alert(
                            event_type=event_type,
                            severity=severity,
                            details=details or "",
                            ip_address=ip_address,
                        ))
                except Exception:
                    pass  # WebSocket push is best-effort

        except Exception as e:
            # Never let audit logging crash the main application
            logger.error(f"[Security] Failed to write audit log: {e}")



    def get_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve security audit logs with optional filtering.
        Used by the Admin Security Dashboard.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            conditions = []
            params: list = []

            if event_type:
                conditions.append("event_type = ?")
                params.append(event_type)
            if severity:
                conditions.append("severity = ?")
                params.append(severity)
            if ip_address:
                conditions.append("ip_address = ?")
                params.append(ip_address)

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            cursor.execute(f'''
                SELECT * FROM security_audit_logs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (*params, limit, offset))
            
            return [dict(row) for row in cursor.fetchall()]

    def get_audit_stats(self) -> Dict[str, Any]:
        """
        Get aggregated statistics for the security dashboard.
        Returns counts by event type and severity for the last 24 hours.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Count by event type (last 24h)
            cursor.execute('''
                SELECT event_type, COUNT(*) as count
                FROM security_audit_logs
                WHERE created_at >= datetime('now', '-24 hours')
                GROUP BY event_type
                ORDER BY count DESC
            ''')
            by_type = {row["event_type"]: row["count"] for row in cursor.fetchall()}

            # Count by severity (last 24h)
            cursor.execute('''
                SELECT severity, COUNT(*) as count
                FROM security_audit_logs
                WHERE created_at >= datetime('now', '-24 hours')
                GROUP BY severity
                ORDER BY count DESC
            ''')
            by_severity = {row["severity"]: row["count"] for row in cursor.fetchall()}

            # Total events (last 24h)
            cursor.execute('''
                SELECT COUNT(*) as total
                FROM security_audit_logs
                WHERE created_at >= datetime('now', '-24 hours')
            ''')
            total_24h = cursor.fetchone()["total"]

            # Top offending IPs (last 24h)
            cursor.execute('''
                SELECT ip_address, COUNT(*) as count
                FROM security_audit_logs
                WHERE created_at >= datetime('now', '-24 hours')
                    AND ip_address IS NOT NULL
                GROUP BY ip_address
                ORDER BY count DESC
                LIMIT 10
            ''')
            top_ips = [{"ip": row["ip_address"], "count": row["count"]} for row in cursor.fetchall()]

            # Recent events (last 50 for the event log)
            cursor.execute('''
                SELECT id, event_type, severity, ip_address, endpoint, details, created_at
                FROM security_audit_logs
                WHERE created_at >= datetime('now', '-24 hours')
                ORDER BY created_at DESC
                LIMIT 50
            ''')
            recent_events = [dict(row) for row in cursor.fetchall()]

            return {
                "total_events": total_24h,
                "events_by_type": by_type,
                "events_by_severity": by_severity,
                "top_ips": top_ips,
                "recent_events": recent_events,
            }


# Singleton instance
security_audit_service = SecurityAuditService()
