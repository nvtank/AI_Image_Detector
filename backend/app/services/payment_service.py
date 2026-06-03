"""
payOS Payment Service
=====================
Handles creation of payOS VietQR payment links and fulfillment of paid orders.

Plan → VND mapping:
  plus      → 49,000 VND  (~$1.99/mo)
  pro       → 149,000 VND (~$5.99/mo)
  tokens_20 → 25,000 VND  (~$0.99)

payOS SDK v2 API reference:
  PayOS.createPaymentLink(CreatePaymentLinkRequest) → CreatePaymentLinkResponse
  PayOS.getPaymentLinkInformation(order_code)       → PaymentLink
  PayOS.verifyPaymentWebhookData(raw_body)          → WebhookData
"""

import sqlite3
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ── Plan definitions ──────────────────────────────────────────────────────────
PLAN_CONFIG = {
    "plus": {
        "amount": 49000,            # VND
        "description": "AI Detector Plus",  # max 25 chars
        "tokens": 100,
        "tier": "plus",
    },
    "pro": {
        "amount": 149000,           # VND
        "description": "AI Detector Pro",
        "tokens": 9999,
        "tier": "pro",
    },
    "tokens_20": {
        "amount": 25000,            # VND
        "description": "20 Tokens AI Detector",
        "tokens": 20,
        "tier": None,               # No tier change — just add tokens
    },
}


# ── PayOS client (lazy init) ──────────────────────────────────────────────────
_payos_client = None


def _get_payos():
    global _payos_client
    if _payos_client is None:
        from payos import PayOS
        _payos_client = PayOS(
            client_id=settings.PAYOS_CLIENT_ID,
            api_key=settings.PAYOS_API_KEY,
            checksum_key=settings.PAYOS_CHECKSUM_KEY,
        )
        logger.info("[PayOS] Client initialized")
    return _payos_client


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _generate_order_code(user_id: int) -> int:
    """
    Generate a unique positive integer order code.
    Format: user_id * 100000 + last 5 digits of unix timestamp.
    Avoids collisions between users and is easy to trace.
    """
    ts_suffix = int(time.time()) % 100000
    return user_id * 100000 + ts_suffix


# ── Public API ────────────────────────────────────────────────────────────────

def create_payment_link(
    user_id: int,
    plan: str,
    return_url: Optional[str] = None,
    cancel_url: Optional[str] = None,
) -> dict:
    """
    Create a payOS VietQR payment link for the given plan.
    Returns: { order_code, checkout_url, qr_code, plan, amount }
    """
    if plan not in PLAN_CONFIG:
        raise ValueError(f"Invalid plan: {plan}. Must be one of: {list(PLAN_CONFIG.keys())}")

    plan_info = PLAN_CONFIG[plan]
    order_code = _generate_order_code(user_id)

    # Ensure uniqueness — retry once if collision
    with _get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM payment_orders WHERE order_code = ?", (order_code,))
        if cur.fetchone():
            time.sleep(1)
            order_code = _generate_order_code(user_id)

    payos = _get_payos()

    try:
        from payos.types import CreatePaymentLinkRequest, ItemData
        req = CreatePaymentLinkRequest(
            order_code=order_code,
            amount=plan_info["amount"],
            description=plan_info["description"][:25],
            items=[
                ItemData(
                    name=plan_info["description"][:50],
                    quantity=1,
                    price=plan_info["amount"],
                )
            ],
            cancel_url=cancel_url or settings.PAYOS_CANCEL_URL,
            return_url=return_url or settings.PAYOS_RETURN_URL,
        )
        response = payos.createPaymentLink(req)
        checkout_url = response.checkout_url
        qr_code = response.qr_code
    except Exception as e:
        logger.error(f"[PayOS] createPaymentLink failed: {e}")
        raise RuntimeError(f"payOS API error: {str(e)}")

    # Persist order to DB
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    with _get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO payment_orders
               (user_id, order_code, plan, amount, status, checkout_url, created_at)
               VALUES (?, ?, ?, ?, 'pending', ?, ?)""",
            (user_id, order_code, plan, plan_info["amount"], checkout_url, now),
        )
        conn.commit()

    logger.info(f"[PayOS] Order created: order_code={order_code}, user={user_id}, plan={plan}")
    return {
        "order_code": order_code,
        "checkout_url": checkout_url,
        "qr_code": qr_code,
        "plan": plan,
        "amount": plan_info["amount"],
    }


def get_payment_order(order_code: int) -> Optional[dict]:
    """Fetch a payment order from DB by order_code."""
    with _get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM payment_orders WHERE order_code = ?", (order_code,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_order_status_from_payos(order_code: int) -> Optional[str]:
    """
    Poll payOS API for the latest payment status.
    Returns: 'PAID', 'PENDING', 'CANCELLED', or None on error.
    """
    try:
        payos = _get_payos()
        info = payos.getPaymentLinkInformation(order_code)
        return str(info.status).upper()   # PaymentLinkStatus enum → string
    except Exception as e:
        logger.warning(f"[PayOS] getPaymentLinkInformation failed for {order_code}: {e}")
        return None


def fulfill_order(order_code: int) -> Optional[dict]:
    """
    Mark the order as paid and upgrade the user's subscription/tokens.
    Returns the updated user dict, or None if order not found.
    Called by: webhook handler OR manual /payment/confirm in dev mode.
    """
    order = get_payment_order(order_code)
    if not order:
        logger.warning(f"[PayOS] fulfill_order: order_code={order_code} not found")
        return None

    if order["status"] == "paid":
        logger.info(f"[PayOS] Order {order_code} already fulfilled")
        from app.services.auth_service import get_user_by_id
        return get_user_by_id(order["user_id"])

    user_id = order["user_id"]
    plan = order["plan"]
    plan_info = PLAN_CONFIG[plan]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")

    with _get_connection() as conn:
        cur = conn.cursor()

        if plan_info["tier"]:
            # Subscription upgrade — set tier, tokens, and 30-day expiry
            new_tokens = plan_info["tokens"]
            cur.execute(
                """UPDATE users
                   SET subscription_tier = ?, tokens = ?, subscription_expires_at = ?, updated_at = ?
                   WHERE id = ?""",
                (plan_info["tier"], new_tokens, expires_at, now, user_id),
            )
            logger.info(
                f"[PayOS] User {user_id} → {plan_info['tier']} "
                f"({new_tokens} tokens, expires {expires_at})"
            )
        else:
            # Token refill only — add tokens without changing tier
            cur.execute(
                "UPDATE users SET tokens = COALESCE(tokens, 0) + ?, updated_at = ? WHERE id = ?",
                (plan_info["tokens"], now, user_id),
            )
            logger.info(f"[PayOS] User {user_id} +{plan_info['tokens']} tokens (refill)")

        # Mark order as paid
        cur.execute(
            "UPDATE payment_orders SET status = 'paid', paid_at = ? WHERE order_code = ?",
            (now, order_code),
        )
        conn.commit()

    from app.services.auth_service import get_user_by_id, resolve_role
    user = get_user_by_id(user_id)
    if user:
        user["role"] = resolve_role(user["email"])
    return user


def cancel_order(order_code: int):
    """Mark a pending order as cancelled in DB."""
    with _get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE payment_orders SET status = 'cancelled' WHERE order_code = ? AND status = 'pending'",
            (order_code,),
        )
        conn.commit()


def verify_webhook_data(raw_body: bytes):
    """
    Verify payOS webhook HMAC-SHA256 signature and return parsed WebhookData.
    raw_body MUST be the raw bytes — never pass parsed JSON.
    Raises WebhookError if signature is invalid.
    """
    payos = _get_payos()
    return payos.verifyPaymentWebhookData(raw_body)
