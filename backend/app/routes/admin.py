"""
Admin Management Routes
=======================
Endpoints (all require admin role):
  GET  /admin/stats                      → Dashboard overview stats
  GET  /admin/users                      → List all users (paginated)
  PATCH /admin/users/{user_id}/role      → Promote/demote user role
  PATCH /admin/users/{user_id}/tier      → Change subscription tier
  DELETE /admin/users/{user_id}          → Delete a user account
  GET  /admin/orders                     → List all payment orders (paginated)
"""

import sqlite3
import logging
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel

from app.config import settings
from app.core.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ── Guard: admin-only ─────────────────────────────────────────────────────────

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ── DB helper ────────────────────────────────────────────────────────────────

def _get_conn():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Schemas ──────────────────────────────────────────────────────────────────

class UpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]


class UpdateTierRequest(BaseModel):
    tier: Literal["free", "plus", "pro"]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_admin_stats(_: dict = Depends(require_admin)):
    """
    Return high-level dashboard statistics for the admin overview.
    """
    with _get_conn() as conn:
        cur = conn.cursor()

        # Total users
        cur.execute("SELECT COUNT(*) as cnt FROM users")
        total_users = cur.fetchone()["cnt"]

        # Users by role
        cur.execute("SELECT role, COUNT(*) as cnt FROM users GROUP BY role")
        role_rows = cur.fetchall()
        users_by_role = {r["role"]: r["cnt"] for r in role_rows}

        # Users by tier
        cur.execute(
            "SELECT COALESCE(subscription_tier, 'free') as tier, COUNT(*) as cnt "
            "FROM users GROUP BY tier"
        )
        tier_rows = cur.fetchall()
        users_by_tier = {r["tier"]: r["cnt"] for r in tier_rows}

        # New users this month
        cur.execute(
            "SELECT COUNT(*) as cnt FROM users "
            "WHERE created_at >= date('now', 'start of month')"
        )
        new_users_month = cur.fetchone()["cnt"]

        # Total predictions
        try:
            cur.execute("SELECT COUNT(*) as cnt FROM prediction_logs")
            total_predictions = cur.fetchone()["cnt"]
        except Exception:
            total_predictions = 0

        # Payment orders
        cur.execute("SELECT COUNT(*) as cnt FROM payment_orders")
        total_orders = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM payment_orders WHERE status = 'paid'")
        paid_orders = cur.fetchone()["cnt"]

        cur.execute(
            "SELECT COALESCE(SUM(amount), 0) as total "
            "FROM payment_orders WHERE status = 'paid'"
        )
        total_revenue = cur.fetchone()["total"]

        # Revenue this month
        cur.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM payment_orders "
            "WHERE status = 'paid' AND paid_at >= date('now', 'start of month')"
        )
        revenue_month = cur.fetchone()["total"]

    return {
        "total_users": total_users,
        "users_by_role": users_by_role,
        "users_by_tier": users_by_tier,
        "new_users_month": new_users_month,
        "total_predictions": total_predictions,
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "total_revenue": total_revenue,
        "revenue_month": revenue_month,
    }


@router.get("/users")
def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    _: dict = Depends(require_admin),
):
    """
    Return all users with optional filtering.
    Excludes password_hash from the response.
    """
    with _get_conn() as conn:
        cur = conn.cursor()

        conditions = []
        params: list = []

        if search:
            conditions.append("(full_name LIKE ? OR email LIKE ?)")
            params += [f"%{search}%", f"%{search}%"]
        if role:
            conditions.append("role = ?")
            params.append(role)
        if tier:
            conditions.append("COALESCE(subscription_tier, 'free') = ?")
            params.append(tier)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(f"SELECT COUNT(*) as cnt FROM users {where}", params)
        total = cur.fetchone()["cnt"]

        cur.execute(
            f"""SELECT id, full_name, email, role,
                       COALESCE(tokens, 5) as tokens,
                       COALESCE(subscription_tier, 'free') as subscription_tier,
                       subscription_expires_at, created_at, updated_at
                FROM users {where}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        )
        users = [dict(r) for r in cur.fetchall()]

    return {"total": total, "users": users, "limit": limit, "offset": offset}


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: UpdateRoleRequest,
    current_admin: dict = Depends(require_admin),
):
    """
    Promote or demote a user's role (admin ↔ user).
    Admin cannot change their own role.
    """
    if user_id == current_admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role.",
        )

    with _get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email FROM users WHERE id = ?", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        cur.execute(
            "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
            (body.role, user_id),
        )
        conn.commit()

    logger.info(
        f"[Admin] User {user_id} role → {body.role} "
        f"(by admin {current_admin['id']})"
    )
    return {"id": user_id, "role": body.role, "message": "Role updated."}


@router.patch("/users/{user_id}/tier")
def update_user_tier(
    user_id: int,
    body: UpdateTierRequest,
    current_admin: dict = Depends(require_admin),
):
    """
    Manually set a user's subscription tier (admin override).
    """
    tier_tokens = {"free": 5, "plus": 100, "pro": 9999}
    new_tokens = tier_tokens.get(body.tier, 5)

    with _get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found.")

        cur.execute(
            "UPDATE users SET subscription_tier = ?, tokens = ?, updated_at = datetime('now') WHERE id = ?",
            (body.tier, new_tokens, user_id),
        )
        conn.commit()

    logger.info(
        f"[Admin] User {user_id} tier → {body.tier} "
        f"(by admin {current_admin['id']})"
    )
    return {"id": user_id, "tier": body.tier, "tokens": new_tokens, "message": "Tier updated."}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_admin: dict = Depends(require_admin),
):
    """
    Delete a user account and all associated data.
    Admin cannot delete themselves.
    """
    if user_id == current_admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )

    with _get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found.")

        # Delete cascading data
        cur.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM payment_orders WHERE user_id = ?", (user_id,))
        try:
            cur.execute("DELETE FROM prediction_logs WHERE user_id = ?", (user_id,))
        except Exception:
            pass
        cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

    logger.info(f"[Admin] User {user_id} deleted by admin {current_admin['id']}")


@router.get("/orders")
def list_orders(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = Query(None),
    _: dict = Depends(require_admin),
):
    """
    Return all payment orders with user info joined.
    """
    with _get_conn() as conn:
        cur = conn.cursor()

        conditions = []
        params: list = []

        if status_filter:
            conditions.append("po.status = ?")
            params.append(status_filter)
        if plan:
            conditions.append("po.plan = ?")
            params.append(plan)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cur.execute(
            f"SELECT COUNT(*) as cnt FROM payment_orders po {where}", params
        )
        total = cur.fetchone()["cnt"]

        cur.execute(
            f"""SELECT po.id, po.order_code, po.plan, po.amount, po.status,
                       po.checkout_url, po.created_at, po.paid_at,
                       u.id as user_id, u.full_name, u.email
                FROM payment_orders po
                LEFT JOIN users u ON po.user_id = u.id
                {where}
                ORDER BY po.created_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        )
        orders = [dict(r) for r in cur.fetchall()]

    return {"total": total, "orders": orders, "limit": limit, "offset": offset}
