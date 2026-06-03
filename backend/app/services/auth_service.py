"""
Authentication Service — Dual-Token System + RBAC
==================================================
Security Design:
  - Access Token: Short-lived JWT (15 min), sent as Bearer in Authorization header.
  - Refresh Token: Long-lived JWT (7 days), stored as a hashed value in the DB.
    Never stored raw; only its SHA-256 hash is persisted.
  - Token Revocation: Logout invalidates the refresh token in DB (blacklist-style).
  - RBAC Roles: guest | user | admin — determined by user.email vs ADMIN_EMAILS list.

Flow:
  1. Login → issue Access Token + Refresh Token → return both to client.
  2. Client stores Access Token in memory; Refresh Token in memory / secure cookie.
  3. On 401 → client calls POST /auth/refresh with Refresh Token.
  4. Server verifies RT against DB hash → issues new Access Token + rotates RT.
  5. Logout → DELETE refresh token from DB → both tokens invalidated.
"""

import hashlib
import secrets
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from jose import JWTError, jwt
from app.config import settings

logger = logging.getLogger(__name__)

# ── Type alias ──────────────────────────────────────────────────────────────
Role = Literal["admin", "user"]


# ── Password Hashing ─────────────────────────────────────────────────────────
import bcrypt


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


# ── RBAC Role Resolution ─────────────────────────────────────────────────────

def resolve_role(email: str) -> Role:
    """
    Determine a user's role. Checks database first, then falls back to the ADMIN_EMAILS config.
    """
    user = get_user_by_email(email)
    if user and user.get("role"):
        return user["role"]

    admin_emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if email.lower() in admin_emails:
        return "admin"
    return "user"


# ── Access Token ─────────────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """
    Issue a short-lived Access Token (15 min default).
    Payload includes: sub (user_id), role, token_type=access.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "token_type": "access",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        # Reject refresh tokens presented as access tokens
        if payload.get("token_type") != "access":
            return None
        return payload
    except JWTError:
        return None


# ── Refresh Token ─────────────────────────────────────────────────────────────

def _hash_refresh_token(token: str) -> str:
    """Hash a refresh token before storing in DB. Never store raw tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_refresh_token(user_id: int) -> str:
    """
    Issue a long-lived Refresh Token (7 days) signed with a SEPARATE secret.
    The raw token is returned once; only its hash is stored in the DB.
    """
    raw_token = secrets.token_urlsafe(32)  # Cryptographically secure random component
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "jti": raw_token,   # Unique token ID (nonce) for revocation
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "token_type": "refresh",
    }
    signed = jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    # Store hash of the signed token in DB
    token_hash = _hash_refresh_token(signed)
    _store_refresh_token(user_id, token_hash, expire)
    
    return signed


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_REFRESH_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("token_type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def verify_refresh_token_in_db(token: str) -> bool:
    """Check that the presented refresh token's hash exists and is not revoked."""
    token_hash = _hash_refresh_token(token)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM refresh_tokens WHERE token_hash = ? AND revoked = 0",
            (token_hash,)
        )
        return cursor.fetchone() is not None


def revoke_refresh_token(token: str):
    """Mark a refresh token as revoked (logout)."""
    token_hash = _hash_refresh_token(token)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?",
            (token_hash,)
        )
        conn.commit()


def revoke_all_user_refresh_tokens(user_id: int):
    """Revoke ALL refresh tokens for a user (force logout all devices)."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?",
            (user_id,)
        )
        conn.commit()
        logger.info(f"[Auth] Revoked all refresh tokens for user_id={user_id}")


# ── Database Helpers ─────────────────────────────────────────────────────────

def _get_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _store_refresh_token(user_id: int, token_hash: str, expires_at: datetime):
    """Persist a hashed refresh token to DB."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    expires_str = expires_at.strftime("%Y-%m-%d %H:%M:%S")
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked, created_at)
               VALUES (?, ?, ?, 0, ?)""",
            (user_id, token_hash, expires_str, now)
        )
        conn.commit()


def cleanup_expired_refresh_tokens():
    """Remove expired refresh tokens from DB. Can be run periodically."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
        )
        deleted = cursor.rowcount
        conn.commit()
        if deleted:
            logger.info(f"[Auth] Cleaned up {deleted} expired refresh tokens")


# ── User CRUD ─────────────────────────────────────────────────────────────────

def get_user_by_email(email: str) -> Optional[dict]:
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_user(full_name: str, email: str, password: str, role: str = "user") -> dict:
    if len(password) < 8:
        raise ValueError("Mật khẩu phải có ít nhất 8 ký tự")
    if not any(c.isdigit() for c in password):
        raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ số")

    existing = get_user_by_email(email)
    if existing:
        raise ValueError("Email đã được đăng ký")

    password_hash = hash_password(password)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (full_name, email, password_hash, role, now, now),
        )
        conn.commit()
        user_id = cursor.lastrowid

    resolved_role = resolve_role(email)
    return {
        "id": user_id,
        "full_name": full_name,
        "email": email,
        "role": resolved_role,
        "tokens": 5,
        "subscription_tier": "free"
    }


def authenticate_user(email: str, password: str) -> Optional[dict]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    role = resolve_role(email)
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": role,
        "tokens": user.get("tokens", 5),
        "subscription_tier": user.get("subscription_tier", "free")
    }


def deduct_user_token(user_id: int) -> bool:
    """
    Deduct 1 token from user balance. Pro users are unlimited and never deducted.
    Returns True if token successfully deducted, False otherwise.
    """
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tokens, subscription_tier FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        tier = row["subscription_tier"] or "free"
        tokens = row["tokens"] if row["tokens"] is not None else 5
        
        if tier == "pro":
            return True  # Unlimited, no deduction
            
        if tokens <= 0:
            return False  # Out of tokens
            
        cursor.execute("UPDATE users SET tokens = tokens - 1 WHERE id = ?", (user_id,))
        conn.commit()
        return True


def upgrade_user_subscription(user_id: int, tier: str) -> Optional[dict]:
    """
    Upgrade subscription tier in DB and reset tokens accordingly.
    """
    new_tokens = 5
    if tier == "plus":
        new_tokens = 100
    elif tier == "pro":
        new_tokens = 9999
        
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET subscription_tier = ?, tokens = ?, updated_at = datetime('now') WHERE id = ?",
            (tier, new_tokens, user_id)
        )
        conn.commit()
        
    user = get_user_by_id(user_id)
    if user:
        user["role"] = resolve_role(user["email"])
    return user


def add_user_tokens(user_id: int, amount: int) -> Optional[dict]:
    """
    Refill/add tokens to the user's balance.
    """
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET tokens = COALESCE(tokens, 0) + ?, updated_at = datetime('now') WHERE id = ?",
            (amount, user_id)
        )
        conn.commit()
        
    user = get_user_by_id(user_id)
    if user:
        user["role"] = resolve_role(user["email"])
    return user
