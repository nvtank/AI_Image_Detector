import sqlite3
import logging
from datetime import datetime, timezone
from typing import Optional

from jose import JWTError, jwt
from datetime import timedelta
from app.config import settings

logger = logging.getLogger(__name__)

import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode('utf-8')
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def _get_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


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


def create_user(full_name: str, email: str, password: str) -> dict:
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    existing = get_user_by_email(email)
    if existing:
        raise ValueError("Email already registered")

    password_hash = hash_password(password)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (full_name, email, password_hash, now, now),
        )
        conn.commit()
        user_id = cursor.lastrowid

    return {"id": user_id, "full_name": full_name, "email": email}


def authenticate_user(email: str, password: str) -> Optional[dict]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return {"id": user["id"], "full_name": user["full_name"], "email": user["email"]}
