"""
Payment Routes — payOS VietQR Integration
==========================================
Endpoints:
  POST /payment/create            → Auth-protected. Create a payOS VietQR payment link.
  POST /payment/webhook           → Public. Receive payOS webhook (HMAC-verified).
  GET  /payment/status/{code}     → Auth-protected. Poll payment status.
  POST /payment/confirm/{code}    → Auth-protected. Dev-only manual fulfillment.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel
from typing import Literal, Optional

from app.config import settings
from app.core.auth import get_current_user
from app.services import payment_service
from app.schemas import UserResponse
from app.services.auth_service import resolve_role, get_user_by_id

router = APIRouter(prefix="/payment", tags=["payment"])
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreatePaymentRequest(BaseModel):
    plan: Literal["plus", "pro", "tokens_20"]


class CreatePaymentResponse(BaseModel):
    order_code: int
    checkout_url: str
    qr_code: Optional[str] = None
    plan: str
    amount: int


class PaymentStatusResponse(BaseModel):
    order_code: int
    plan: str
    status: str           # 'pending', 'paid', 'cancelled'
    amount: int
    checkout_url: Optional[str] = None
    user: Optional[UserResponse] = None   # populated when status == 'paid'


def _make_user_response(user: dict) -> UserResponse:
    role = resolve_role(user["email"])
    return UserResponse(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=role,
        tokens=user.get("tokens", 5),
        subscription_tier=user.get("subscription_tier", "free"),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/create", response_model=CreatePaymentResponse)
async def create_payment(
    body: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a payOS VietQR payment link.
    Returns checkout_url to open in new tab + order_code for status polling.
    """
    try:
        result = payment_service.create_payment_link(
            user_id=current_user["id"],
            plan=body.plan,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"[Payment] Unexpected error creating payment link: {e}")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tạo link thanh toán.")


@router.post("/webhook")
async def payos_webhook(request: Request):
    """
    Receive payment success/cancel notifications from payOS.
    payOS sends POST with HMAC-SHA256 signature — MUST verify with raw bytes.
    """
    raw_body = await request.body()

    # payOS sends a test ping with empty/minimal data — acknowledge it
    if not raw_body or raw_body in (b'{}', b''):
        return {"message": "OK"}

    try:
        webhook_data = payment_service.verify_webhook_data(raw_body)
    except Exception as e:
        logger.warning(f"[Webhook] Signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    order_code = getattr(webhook_data, "order_code", None)
    payment_code = getattr(webhook_data, "code", None)  # '00' = success

    if not order_code:
        logger.warning("[Webhook] Received webhook without order_code")
        return {"message": "OK"}

    if payment_code == "00":
        # Payment successful — fulfill the order
        try:
            user = payment_service.fulfill_order(int(order_code))
            if user:
                logger.info(
                    f"[Webhook] Order {order_code} fulfilled for user_id={user.get('id')}"
                )
        except Exception as e:
            logger.error(f"[Webhook] Error fulfilling order {order_code}: {e}")
    else:
        logger.info(f"[Webhook] Order {order_code} not successful (code={payment_code})")
        payment_service.cancel_order(int(order_code))

    return {"message": "OK"}


@router.get("/status/{order_code}", response_model=PaymentStatusResponse)
async def get_payment_status(
    order_code: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Poll for the payment status of a specific order.
    Frontend calls this every ~3s after opening payOS QR page in new tab.
    Also cross-checks with payOS API in case webhook was missed.
    """
    order = payment_service.get_payment_order(order_code)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")

    # Security: only allow access to own orders
    if order["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập đơn hàng này.")

    current_status = order["status"]

    # If still pending, cross-check with payOS API (webhook fallback)
    if current_status == "pending":
        payos_status = payment_service.get_order_status_from_payos(order_code)
        if payos_status == "PAID":
            user = payment_service.fulfill_order(order_code)
            if user:
                current_status = "paid"
                return PaymentStatusResponse(
                    order_code=order["order_code"],
                    plan=order["plan"],
                    status="paid",
                    amount=order["amount"],
                    checkout_url=order.get("checkout_url"),
                    user=_make_user_response(user),
                )
        elif payos_status == "CANCELLED":
            payment_service.cancel_order(order_code)
            current_status = "cancelled"

    response = PaymentStatusResponse(
        order_code=order["order_code"],
        plan=order["plan"],
        status=current_status,
        amount=order["amount"],
        checkout_url=order.get("checkout_url"),
    )

    # Include updated user data when paid
    if current_status == "paid":
        user = get_user_by_id(order["user_id"])
        if user:
            response.user = _make_user_response(user)

    return response


@router.post("/confirm/{order_code}")
async def dev_confirm_payment(
    order_code: int,
    current_user: dict = Depends(get_current_user),
):
    """
    [DEV MODE ONLY] Manually fulfill a pending payment order.
    Use for local development where payOS webhook can't reach localhost.
    Disabled automatically when PAYOS_DEV_MODE=False.
    """
    if not settings.PAYOS_DEV_MODE:
        raise HTTPException(
            status_code=403,
            detail="Dev endpoint is disabled in production (PAYOS_DEV_MODE=False).",
        )

    order = payment_service.get_payment_order(order_code)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")

    if order["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập đơn hàng này.")

    if order["status"] == "paid":
        user = get_user_by_id(order["user_id"])
        return {
            "message": "Đơn hàng đã được xử lý rồi.",
            "status": "paid",
            "user": _make_user_response(user) if user else None,
        }

    user = payment_service.fulfill_order(order_code)
    if not user:
        raise HTTPException(status_code=500, detail="Không thể hoàn tất đơn hàng.")

    logger.info(f"[DEV] Order {order_code} manually confirmed for user {user['id']}")

    return {
        "message": "✅ Thanh toán xác nhận thành công (dev mode).",
        "status": "paid",
        "user": _make_user_response(user),
    }
