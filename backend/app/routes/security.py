"""
Security Audit API Routes.
Provides endpoints for the Admin Security Dashboard to retrieve
audit logs and security statistics.
Admin-only: requires 'admin' RBAC role.
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.auth import require_admin
from app.services.security_audit_service import security_audit_service

router = APIRouter(prefix="/security", tags=["security"])


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, HIGH, CRITICAL"),
    ip_address: Optional[str] = Query(None, description="Filter by IP address"),
    current_user: dict = Depends(require_admin),
):
    """
    Retrieve security audit logs. Requires Admin role.
    Returns recent security events for monitoring dashboard.
    """
    logs = security_audit_service.get_audit_logs(
        limit=limit,
        offset=offset,
        event_type=event_type,
        severity=severity,
        ip_address=ip_address,
    )
    return {"audit_logs": logs, "total": len(logs)}


@router.get("/audit-stats")
async def get_audit_stats(
    current_user: dict = Depends(require_admin),
):
    """
    Get aggregated security statistics for the last 24 hours.
    Used by the Admin Security Dashboard for charts and counters.
    Requires Admin role.
    """
    stats = security_audit_service.get_audit_stats()
    return stats
