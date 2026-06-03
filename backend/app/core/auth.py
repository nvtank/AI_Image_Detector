"""
Core Auth Dependencies — RBAC Guards
=====================================
Provides FastAPI dependency functions for route protection:

  get_current_user        → any authenticated user (user or admin)
  require_admin           → admin role only
  get_optional_user       → returns None if unauthenticated (no 401 raised)

Role hierarchy:  admin > user
RBAC is enforced here, not in individual routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from app.services.auth_service import (
    decode_access_token,
    get_user_by_id,
    resolve_role,
)

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency: validates Bearer access token, returns user dict with role.
    Raises HTTP 401 if token is missing, invalid, expired, or wrong type.
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu thông tin người dùng.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(int(user_id_str))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = resolve_role(user["email"])
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": role,
        "tokens": user.get("tokens", 5),
        "subscription_tier": user.get("subscription_tier", "free")
    }


def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    FastAPI dependency: requires the current user to have 'admin' role.
    Raises HTTP 403 Forbidden if the user is not an admin.
    Depends on get_current_user, so also validates authentication.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(admin: dict = Depends(require_admin)):
            ...
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập chức năng này. Yêu cầu quyền Admin.",
        )
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme_optional),
) -> Optional[dict]:
    """
    FastAPI dependency: returns the current user if authenticated, or None if not.
    Does NOT raise 401 — useful for endpoints that behave differently for
    authenticated vs anonymous users (e.g., public endpoints with enhanced features for logged-in users).
    """
    if not credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None

    user_id_str = payload.get("sub")
    if not user_id_str:
        return None

    user = get_user_by_id(int(user_id_str))
    if not user:
        return None

    role = resolve_role(user["email"])
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": role,
    }
