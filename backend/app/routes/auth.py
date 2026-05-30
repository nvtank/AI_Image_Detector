"""
Auth API Routes — Dual-Token System + RBAC
==========================================
Endpoints:
  POST /auth/signup       → Register new user, returns Access + Refresh tokens
  POST /auth/login        → Authenticate, returns Access + Refresh tokens
  POST /auth/refresh      → Exchange valid Refresh Token for new Access + Refresh tokens (rotation)
  POST /auth/logout       → Revoke current Refresh Token (this device)
  POST /auth/logout-all   → Revoke ALL Refresh Tokens for user (all devices)
  GET  /auth/me           → Return current user profile + role
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from app.schemas import UserCreate, UserLogin, AuthResponse, UserResponse, RefreshTokenRequest
from app.services import auth_service
from app.core.auth import get_current_user
from app.middleware.rate_limiter import limiter
from app.services.security_audit_service import security_audit_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: UserCreate):
    """
    Register a new user account.
    Returns both Access Token (15 min) and Refresh Token (7 days).
    Rate limit: 5/min per IP.
    """
    try:
        user = auth_service.create_user(
            full_name=body.full_name,
            email=body.email,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    access_token = auth_service.create_access_token({
        "sub": str(user["id"]),
        "role": user["role"],
    })
    refresh_token = auth_service.create_refresh_token(user["id"])

    return AuthResponse(
        user=UserResponse(id=user["id"], full_name=user["full_name"], email=user["email"], role=user["role"]),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: UserLogin):
    """
    Authenticate and receive Access + Refresh tokens.
    Rate limit: 10/min per IP (brute-force protection).
    """
    user = auth_service.authenticate_user(body.email, body.password)
    if not user:
        client_ip = request.client.host if request.client else "unknown"
        security_audit_service.log_event(
            event_type="LOGIN_FAILED",
            ip_address=client_ip,
            endpoint="/auth/login",
            method="POST",
            details=f"Failed login attempt for email: {body.email}",
            severity="WARNING",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )

    access_token = auth_service.create_access_token({
        "sub": str(user["id"]),
        "role": user["role"],
    })
    refresh_token = auth_service.create_refresh_token(user["id"])

    return AuthResponse(
        user=UserResponse(id=user["id"], full_name=user["full_name"], email=user["email"], role=user["role"]),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=AuthResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, body: RefreshTokenRequest):
    """
    Token Rotation Endpoint.
    Validates the presented Refresh Token, revokes it, and issues a new pair
    (Access Token + Refresh Token). This is called "Refresh Token Rotation" —
    each Refresh Token can only be used once, preventing replay attacks.
    """
    # 1. Verify JWT signature and expiry
    payload = auth_service.decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ hoặc đã hết hạn.",
        )

    # 2. Verify the token hash exists in DB and is not revoked
    if not auth_service.verify_refresh_token_in_db(body.refresh_token):
        # Possible reuse of a revoked token — security incident
        user_id = int(payload.get("sub", 0))
        security_audit_service.log_event(
            event_type="REFRESH_TOKEN_REUSE",
            ip_address=request.client.host if request.client else None,
            endpoint="/auth/refresh",
            method="POST",
            user_id=user_id,
            details="Attempt to reuse a revoked refresh token detected. Possible token theft.",
            severity="HIGH",
        )
        # Force logout all devices for this user (token theft response)
        if user_id:
            auth_service.revoke_all_user_refresh_tokens(user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        )

    user_id = int(payload["sub"])
    user = auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Người dùng không tồn tại.")

    # 3. Revoke the OLD refresh token (rotation — one-time use)
    auth_service.revoke_refresh_token(body.refresh_token)

    # 4. Issue NEW Access Token + NEW Refresh Token
    role = auth_service.resolve_role(user["email"])
    new_access_token = auth_service.create_access_token({
        "sub": str(user["id"]),
        "role": role,
    })
    new_refresh_token = auth_service.create_refresh_token(user["id"])

    return AuthResponse(
        user=UserResponse(id=user["id"], full_name=user["full_name"], email=user["email"], role=role),
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshTokenRequest):
    """
    Logout from this device.
    Revokes the presented Refresh Token. The Access Token will expire naturally (max 15 min).
    """
    if body.refresh_token:
        auth_service.revoke_refresh_token(body.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(current_user: dict = Depends(get_current_user)):
    """
    Logout from ALL devices.
    Revokes ALL Refresh Tokens for the current user (requires valid Access Token).
    """
    auth_service.revoke_all_user_refresh_tokens(current_user["id"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return currently authenticated user profile including RBAC role."""
    return UserResponse(**current_user)
