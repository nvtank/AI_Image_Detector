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

import secrets
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, HTTPException, status, Depends, Request
from app.config import settings
from app.schemas import (
    UserCreate, UserLogin, AuthResponse, UserResponse, RefreshTokenRequest,
    GithubLoginRequest, ForgotPasswordRequest, ResetPasswordRequest, ConfigResponse
)
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


@router.get("/config", response_model=ConfigResponse)
async def get_auth_config():
    """Return public auth settings like whether GitHub login is configured."""
    return ConfigResponse(
        github_client_id=settings.GITHUB_CLIENT_ID,
        github_enabled=bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET)
    )


@router.post("/github", response_model=AuthResponse)
async def github_login(request: Request, body: GithubLoginRequest):
    """
    Authenticate using GitHub OAuth authorization code.
    If the user doesn't exist, they are registered with a random password.
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth is not configured on this server."
        )

    # 1. Exchange authorization code for access token
    async with httpx.AsyncClient() as client:
        try:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": body.code,
                },
                timeout=10.0
            )
            token_res.raise_for_status()
            token_data = token_res.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange code with GitHub: {str(e)}"
            )

    gh_access_token = token_data.get("access_token")
    if not gh_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth error: {token_data.get('error_description', 'No access token received.')}"
        )

    # 2. Get user profile
    async with httpx.AsyncClient() as client:
        try:
            user_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {gh_access_token}",
                    "User-Agent": "AI-Image-Detector-Backend"
                },
                timeout=10.0
            )
            user_res.raise_for_status()
            gh_profile = user_res.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch user profile from GitHub: {str(e)}"
            )

    # 3. Get user email
    email = gh_profile.get("email")
    if not email:
        # Fetch emails from user/emails endpoint if private
        async with httpx.AsyncClient() as client:
            try:
                emails_res = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {gh_access_token}",
                        "User-Agent": "AI-Image-Detector-Backend"
                    },
                    timeout=10.0
                )
                emails_res.raise_for_status()
                emails_list = emails_res.json()
                # Find primary email
                primary_emails = [e for e in emails_list if e.get("primary") and e.get("verified")]
                if primary_emails:
                    email = primary_emails[0]["email"]
                elif emails_list:
                    email = emails_list[0]["email"]
            except Exception:
                pass

    if not email:
        # Fallback if email is still not available
        email = f"{gh_profile.get('login')}@github.user"

    full_name = gh_profile.get("name") or gh_profile.get("login") or "GitHub User"

    # 4. Check if user exists in database, or create them
    user = auth_service.get_user_by_email(email)
    if not user:
        # Register a new user
        random_password = secrets.token_urlsafe(16) + "1a"  # satisfies digit and length requirements
        user = auth_service.create_user(
            full_name=full_name,
            email=email,
            password=random_password,
            role="user"
        )
    
    # 5. Generate tokens
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


def _send_smtp_email(to_email: str, subject: str, html_content: str):
    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_PASSWORD:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """
    Generate password reset token, save to DB, print to console,
    and send email if SMTP is configured.
    """
    email = body.email.strip().lower()
    user = auth_service.get_user_by_email(email)
    
    # Generate token always to prevent timing attacks,
    # but only store and send if user exists
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")

    dev_token = None

    if user:
        # Save to database
        try:
            conn = sqlite3.connect(settings.DATABASE_PATH)
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
                (email, token, expires_at)
            )
            conn.commit()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        finally:
            conn.close()

        # Get frontend origin dynamically from headers
        origin = request.headers.get("origin")
        if not origin and request.headers.get("referer"):
            from urllib.parse import urlparse
            referer = request.headers.get("referer")
            parsed_uri = urlparse(referer)
            origin = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
        
        if not origin:
            origin = "http://localhost:3000"
            
        reset_url = f"{origin}/reset-password?token={token}"
        print(f"\n[SMTP MOCK] Password reset link for {email}:\n{reset_url}\n")

        # Try sending email
        if settings.SMTP_HOST:
            try:
                html_body = f"""
                <h3>Yêu cầu đặt lại mật khẩu</h3>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {email}.</p>
                <p>Vui lòng click vào link dưới đây để đặt lại mật khẩu của bạn (link có giá trị trong 15 phút):</p>
                <p><a href="{reset_url}">{reset_url}</a></p>
                <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email.</p>
                """
                _send_smtp_email(email, "Đặt lại mật khẩu - AI Image Detector", html_body)
            except Exception as e:
                print(f"[SMTP ERROR] Failed to send email to {email}: {e}")
                # Don't fail the API call, let dev mode handle it
                dev_token = token
        else:
            # SMTP not configured - expose token in dev response for easy testing
            dev_token = token

    return {
        "message": "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.",
        "dev_token": dev_token  # Non-null only in local/dev mode without SMTP
    }


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, body: ResetPasswordRequest):
    """
    Reset password using a valid reset token.
    """
    token = body.token.strip()
    new_password = body.new_password
    
    # 1. Validate password strength
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 8 ký tự")
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(status_code=400, detail="Mật khẩu phải chứa ít nhất 1 chữ số")

    # 2. Check token in database
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM password_resets WHERE token = ? AND used = 0",
            (token,)
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác thực không hợp lệ hoặc đã được sử dụng."
            )
            
        reset_req = dict(row)
        expires_at_dt = datetime.strptime(reset_req["expires_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        now_dt = datetime.now(timezone.utc)
        
        if now_dt > expires_at_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác thực đã hết hạn."
            )
            
        email = reset_req["email"]
        
        # 3. Update password in users table
        password_hash = auth_service.hash_password(new_password)
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        
        cur.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?",
            (password_hash, now_str, email)
        )
        
        # 4. Mark token as used
        cur.execute(
            "UPDATE password_resets SET used = 1 WHERE id = ?",
            (reset_req["id"],)
        )
        conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    finally:
        conn.close()
        
    return {"message": "Mật khẩu đã được đặt lại thành công."}
