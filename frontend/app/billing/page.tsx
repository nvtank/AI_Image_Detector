"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type Plan = "plus" | "pro" | "tokens_20";

interface PendingPayment {
  order_code: number;
  checkout_url: string;
  plan: Plan;
  amount: number;
}

// ── Plan metadata ──────────────────────────────────────────────────────────
const PLAN_INFO = {
  plus: { label: "Plus", price: "49.000₫", usd: "$1.99", tokens: 100 },
  pro: { label: "Pro", price: "149.000₫", usd: "$5.99", tokens: -1 },
  tokens_20: { label: "20 Tokens", price: "25.000₫", usd: "$0.99", tokens: 20 },
};

export default function BillingPage() {
  return (
    <AuthGuard>
      <BillingContent />
    </AuthGuard>
  );
}

function BillingContent() {
  const { user, refreshUser, isAdmin } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  // If admin, redirect to upload page since admin has no limits/billing
  useEffect(() => {
    if (isAdmin) {
      router.push("/upload");
    }
  }, [isAdmin, router]);

  if (isAdmin) {
    return null;
  }

  // payOS payment state
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "creating" | "waiting" | "paid" | "cancelled" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [creatingPlan, setCreatingPlan] = useState<Plan | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup polling on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Refresh user on page mount ─────────────────────────────────────────
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // ── Start payOS payment flow ───────────────────────────────────────────
  const handleBuy = async (plan: Plan) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCreatingPlan(plan);
    setPaymentStatus("creating");

    try {
      const result = await api.createPaymentLink(plan);
      setPendingPayment({
        order_code: result.order_code,
        checkout_url: result.checkout_url,
        plan,
        amount: result.amount,
      });
      setPaymentStatus("waiting");
      setPollCount(0);

      // Open payOS QR page in new tab
      window.open(result.checkout_url, "_blank", "noopener,noreferrer");

      // Start polling every 3s
      startPolling(result.order_code, plan);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tạo link thanh toán. Vui lòng thử lại.");
      setPaymentStatus("error");
    } finally {
      setCreatingPlan(null);
    }
  };

  // ── Poll payment status ────────────────────────────────────────────────
  const startPolling = (orderCode: number, plan: Plan) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    let count = 0;
    const MAX_POLLS = 60; // 3 minutes max (60 × 3s)

    pollIntervalRef.current = setInterval(async () => {
      count++;
      setPollCount(count);

      try {
        const status = await api.getPaymentStatus(orderCode);

        if (status.status === "paid") {
          clearInterval(pollIntervalRef.current!);
          setPaymentStatus("paid");
          if (status.user) {
            await refreshUser();
          }
          const planLabel = PLAN_INFO[plan].label;
          setSuccessMsg(
            locale === "vi"
              ? `🎉 Thanh toán thành công! Gói ${planLabel} đã được kích hoạt.`
              : `🎉 Payment successful! ${planLabel} plan activated.`
          );
          setPendingPayment(null);
        } else if (status.status === "cancelled") {
          clearInterval(pollIntervalRef.current!);
          setPaymentStatus("cancelled");
          setErrorMsg(locale === "vi" ? "Giao dịch đã bị huỷ." : "Transaction was cancelled.");
          setPendingPayment(null);
        } else if (count >= MAX_POLLS) {
          // Timeout — stop polling
          clearInterval(pollIntervalRef.current!);
          setPaymentStatus("error");
          setErrorMsg(
            locale === "vi"
              ? "Hết thời gian chờ. Nếu đã thanh toán, tài khoản sẽ được cập nhật trong vài phút."
              : "Timeout. If you paid, your account will update shortly."
          );
          setPendingPayment(null);
        }
      } catch {
        // Network error during poll — just keep retrying silently
      }
    }, 3000);
  };

  // ── Dev mode manual confirm ────────────────────────────────────────────
  const handleDevConfirm = async () => {
    if (!pendingPayment) return;
    try {
      const result = await api.devConfirmPayment(pendingPayment.order_code);
      if (result.status === "paid") {
        clearInterval(pollIntervalRef.current!);
        setPaymentStatus("paid");
        await refreshUser();
        setSuccessMsg(
          locale === "vi"
            ? `🎉 Xác nhận thành công (dev mode)! Gói ${PLAN_INFO[pendingPayment.plan].label} đã kích hoạt.`
            : `🎉 Confirmed (dev mode)! ${PLAN_INFO[pendingPayment.plan].label} activated.`
        );
        setPendingPayment(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCancelWaiting = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPendingPayment(null);
    setPaymentStatus("idle");
    setErrorMsg(null);
  };

  // ── Plan button state helpers ──────────────────────────────────────────
  const canBuyPlus = user?.subscription_tier === "free";
  const canBuyPro = user?.subscription_tier !== "pro";
  const canBuyTokens = user?.subscription_tier !== "pro";

  const tier = user?.subscription_tier ?? "free";

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4">
      {/* ── Header ── */}
      <div className="mb-10 text-center">
        <h1
          style={{ fontSize: 32, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.96px" }}
          className="mb-2"
        >
          {t("billing.title")}
        </h1>
        <p className="text-lg" style={{ color: "var(--body)" }}>
          {t("billing.subtitle")}
        </p>
      </div>

      {/* ── Success Banner ── */}
      {successMsg && (
        <div
          className="p-4 mb-8 text-center rounded-xl"
          style={{
            background: "var(--positive-pale)",
            border: "1px solid var(--positive-soft)",
            color: "var(--positive)",
            fontWeight: 600,
            animation: "fadeUp 0.3s ease-out",
          }}
        >
          {successMsg}
        </div>
      )}

      {/* ── Error Banner ── */}
      {errorMsg && paymentStatus !== "waiting" && (
        <div
          className="p-4 mb-8 text-center rounded-xl"
          style={{
            background: "var(--negative-pale)",
            border: "1px solid var(--negative-soft, #fca5a5)",
            color: "var(--negative)",
            fontWeight: 500,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ── Current Balance + Token Refill ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 items-stretch">
        {/* Current Status Card */}
        <div
          className="card p-6 md:col-span-7 flex flex-col justify-between"
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--canvas)",
            border: "1px solid var(--canvas-soft)",
          }}
        >
          <div>
            <span className="text-xs uppercase font-bold tracking-wider" style={{ color: "var(--mute)" }}>
              {t("billing.currentPlan")}
            </span>
            <div className="flex items-center gap-2.5 mt-1.5 mb-4">
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", textTransform: "capitalize" }}>
                {tier === "pro"
                  ? t("billing.proPlan")
                  : tier === "plus"
                    ? t("billing.plusPlan")
                    : t("billing.freePlan")}
              </h2>
              <span className="badge-positive text-xs">{t("billing.active")}</span>
            </div>
          </div>

          <div
            className="p-5 mt-auto rounded-xl"
            style={{
              background: tier === "pro"
                ? "linear-gradient(135deg, var(--primary-pale), var(--canvas-soft))"
                : "var(--canvas-soft)",
              border: "1px solid var(--canvas-soft)",
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 32 }}>🪙</span>
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {tier === "pro"
                    ? t("billing.unlimitedTokens")
                    : `${user?.tokens ?? 0} ${t("billing.tokensRemaining")}`}
                </span>
                <span className="text-xs block" style={{ color: "var(--mute)" }}>
                  {tier === "free"
                    ? (locale === "vi" ? "Chỉ phân tích bằng Local model" : "Local model only")
                    : tier === "plus"
                      ? (locale === "vi" ? "Có ý kiến chéo từ Gemini" : "Gemini opinion enabled")
                      : (locale === "vi" ? "Full tính năng + Hàng đợi Celery" : "All features + Celery queue unlocked")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Token Refill Card */}
        <div
          className="card p-6 md:col-span-5 flex flex-col justify-between"
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--canvas)",
            border: "1px solid var(--canvas-soft)",
          }}
        >
          <div>
            <h3 style={{ fontWeight: 700, color: "var(--ink)" }} className="text-base mb-1">
              {t("billing.buyTokensTitle")}
            </h3>
            <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--mute)" }}>
              {locale === "vi"
                ? "Mua thêm lượt phân tích mà không cần nâng cấp gói."
                : "Buy more analysis credits without upgrading your plan."}
            </p>
          </div>

          <button
            onClick={() => canBuyTokens && handleBuy("tokens_20")}
            disabled={!canBuyTokens || creatingPlan === "tokens_20"}
            className="btn-primary w-full text-center py-3 flex items-center justify-center gap-2"
            style={{
              borderRadius: "var(--r-xl)",
              opacity: !canBuyTokens ? 0.4 : 1,
              cursor: !canBuyTokens ? "not-allowed" : "pointer",
            }}
          >
            {creatingPlan === "tokens_20" ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span>⚡</span>
            )}
            <span>
              {locale === "vi"
                ? `Mua 20 Tokens — 25.000₫`
                : `Buy 20 Tokens — 25,000₫`}
            </span>
          </button>
          {tier === "pro" && (
            <p className="text-xs text-center mt-2" style={{ color: "var(--mute)" }}>
              {locale === "vi" ? "Pro có token không giới hạn 🎉" : "Pro has unlimited tokens 🎉"}
            </p>
          )}
        </div>
      </div>

      {/* ── Plans Grid ── */}
      <h3
        style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", textAlign: "center" }}
        className="mb-8"
      >
        {locale === "vi" ? "Chọn gói dịch vụ" : "Choose Your Subscription Plan"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* FREE */}
        <PlanCard
          name={t("billing.freePlan")}
          price="$0"
          priceVnd="0₫"
          desc={t("billing.freePlanDesc")}
          isCurrent={tier === "free"}
          features={[
            { text: "5 tokens", ok: true },
            { text: "Local Model (EfficientNetV2)", ok: true },
            { text: t("billing.unlockedGemini"), ok: false },
            { text: t("billing.unlockedAsync"), ok: false },
          ]}
          buttonLabel={t("billing.currentPlanBtn")}
          buttonDisabled
          locale={locale}
        />

        {/* PLUS */}
        <PlanCard
          name={t("billing.plusPlan")}
          price="$1.99"
          priceVnd="49.000₫"
          desc={t("billing.plusPlanDesc")}
          isCurrent={tier === "plus"}
          features={[
            { text: `100 tokens / ${locale === "vi" ? "tháng" : "month"}`, ok: true },
            { text: "Local Model (EfficientNetV2)", ok: true },
            { text: t("billing.unlockedGemini"), ok: true },
            { text: t("billing.unlockedAsync"), ok: false },
          ]}
          buttonLabel={
            tier === "plus"
              ? t("billing.currentPlanBtn")
              : tier === "pro"
                ? (locale === "vi" ? "Đã ở gói cao hơn" : "Downgrade locked")
                : t("billing.upgradeBtn")
          }
          buttonDisabled={!canBuyPlus || !!creatingPlan}
          isLoading={creatingPlan === "plus"}
          onBuy={() => handleBuy("plus")}
          paymentNote={locale === "vi" ? "Thanh toán qua VietQR" : "Pay via VietQR"}
          locale={locale}
        />

        {/* PRO */}
        <PlanCard
          name={t("billing.proPlan")}
          price="$5.99"
          priceVnd="149.000₫"
          desc={t("billing.proPlanDesc")}
          isCurrent={tier === "pro"}
          recommended
          features={[
            { text: `${locale === "vi" ? "Không giới hạn" : "Unlimited"} tokens`, ok: true },
            { text: "Local Model (EfficientNetV2)", ok: true },
            { text: t("billing.unlockedGemini"), ok: true },
            { text: t("billing.unlockedAsync"), ok: true },
          ]}
          buttonLabel={
            tier === "pro"
              ? t("billing.currentPlanBtn")
              : t("billing.upgradeBtn")
          }
          buttonDisabled={!canBuyPro || !!creatingPlan}
          isLoading={creatingPlan === "pro"}
          onBuy={() => handleBuy("pro")}
          paymentNote={locale === "vi" ? "Thanh toán qua VietQR" : "Pay via VietQR"}
          locale={locale}
        />
      </div>

      {/* ── payOS VietQR Waiting Modal ── */}
      {pendingPayment && paymentStatus === "waiting" && (
        <PaymentWaitingModal
          payment={pendingPayment}
          pollCount={pollCount}
          onCancel={handleCancelWaiting}
          onDevConfirm={handleDevConfirm}
          locale={locale}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

interface FeatureItem {
  text: string;
  ok: boolean;
}

interface PlanCardProps {
  name: string;
  price: string;
  priceVnd: string;
  desc: string;
  isCurrent: boolean;
  features: FeatureItem[];
  buttonLabel: string;
  buttonDisabled?: boolean;
  isLoading?: boolean;
  onBuy?: () => void;
  recommended?: boolean;
  paymentNote?: string;
  locale: string;
}

function PlanCard({
  name, price, priceVnd, desc, isCurrent, features,
  buttonLabel, buttonDisabled, isLoading, onBuy, recommended, paymentNote, locale,
}: PlanCardProps) {
  return (
    <div
      className="card p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg"
      style={{
        borderRadius: "var(--r-xl)",
        background: "var(--canvas)",
        border: isCurrent ? "2px solid var(--primary)" : "1px solid var(--canvas-soft)",
        boxShadow: isCurrent ? "0 4px 20px rgba(124, 58, 237, 0.12)" : "none",
        position: "relative",
      }}
    >
      {recommended && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] uppercase font-black px-3 py-1 rounded-full text-white"
          style={{
            background: "linear-gradient(135deg, #f59e0b, var(--primary))",
            letterSpacing: "1px",
          }}
        >
          ⭐ {locale === "vi" ? "Khuyên dùng" : "Recommended"} ⭐
        </span>
      )}
      {isCurrent && (
        <span
          className="absolute top-3 right-3 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded"
          style={{ background: "var(--primary-pale)", color: "var(--primary)" }}
        >
          {locale === "vi" ? "Hiện tại" : "Current"}
        </span>
      )}

      <div>
        <h4 style={{ fontWeight: 800, color: "var(--ink)" }} className="text-lg mb-1">
          {name}
        </h4>
        <p className="text-xs mb-4" style={{ color: "var(--mute)" }}>
          {desc}
        </p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-black" style={{ color: "var(--ink)" }}>{priceVnd}</span>
          <span className="text-xs" style={{ color: "var(--mute)" }}>/ {locale === "vi" ? "tháng" : "mo"}</span>
        </div>
        <div className="text-xs mb-5" style={{ color: "var(--mute)" }}>({price})</div>

        <ul className="text-xs space-y-2.5 mb-8" style={{ color: "var(--body)" }}>
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2" style={{ opacity: f.ok ? 1 : 0.4 }}>
              {f.ok ? "✅" : "❌"} <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onBuy}
          disabled={buttonDisabled}
          className="btn-primary w-full text-center py-2.5 text-xs flex items-center justify-center gap-2"
          style={{
            borderRadius: "var(--r-md)",
            opacity: buttonDisabled ? 0.4 : 1,
            cursor: buttonDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>{locale === "vi" ? "Đang tạo link..." : "Creating link..."}</span>
            </>
          ) : (
            buttonLabel
          )}
        </button>
        {paymentNote && !buttonDisabled && (
          <p className="text-center text-[10px]" style={{ color: "var(--mute)" }}>
            📱 {paymentNote}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Payment Waiting Modal ──────────────────────────────────────────────────
interface PaymentWaitingModalProps {
  payment: PendingPayment;
  pollCount: number;
  onCancel: () => void;
  onDevConfirm: () => void;
  locale: string;
}

function PaymentWaitingModal({ payment, pollCount, onCancel, onDevConfirm, locale }: PaymentWaitingModalProps) {
  const planInfo = PLAN_INFO[payment.plan];
  const dots = ".".repeat((pollCount % 3) + 1);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        className="card p-8 w-full max-w-sm text-center"
        style={{
          background: "var(--canvas)",
          borderRadius: "var(--r-xl)",
          border: "1px solid var(--canvas-soft)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Animated QR icon */}
        <div className="mb-6 flex flex-col items-center gap-4">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary-pale), var(--canvas-soft))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            📱
          </div>
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-1"
              style={{ background: "var(--primary-pale)", color: "var(--primary)" }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  display: "inline-block",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              {locale === "vi" ? `Đang chờ thanh toán${dots}` : `Waiting for payment${dots}`}
            </div>
          </div>
        </div>

        {/* Order info */}
        <div
          className="p-4 rounded-xl mb-6 text-left"
          style={{ background: "var(--canvas-soft)" }}
        >
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: "var(--mute)" }}>
              {locale === "vi" ? "Gói dịch vụ" : "Plan"}
            </span>
            <span style={{ color: "var(--ink)", fontWeight: 700 }}>{planInfo.label}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: "var(--mute)" }}>
              {locale === "vi" ? "Số tiền" : "Amount"}
            </span>
            <span style={{ color: "var(--ink)", fontWeight: 700 }}>{planInfo.price}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: "var(--mute)" }}>Order code</span>
            <span style={{ color: "var(--mute)", fontFamily: "monospace" }}>#{payment.order_code}</span>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-sm mb-4" style={{ color: "var(--body)", lineHeight: 1.6 }}>
          {locale === "vi"
            ? "Quét mã QR VietQR trên trang vừa mở để hoàn tất thanh toán. Trang này tự động cập nhật sau khi bạn thanh toán."
            : "Scan the VietQR code on the page that just opened to complete payment. This page updates automatically once paid."}
        </p>

        {/* Reopen link */}
        <a
          href={payment.checkout_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline block mb-6"
          style={{ color: "var(--primary)" }}
        >
          {locale === "vi" ? "↗ Mở lại trang thanh toán" : "↗ Reopen payment page"}
        </a>

        {/* Dev confirm button */}
        <div className="border-t pt-4 mb-4" style={{ borderColor: "var(--canvas-soft)" }}>
          <p className="text-[10px] mb-2" style={{ color: "var(--mute)" }}>
            🛠 {locale === "vi" ? "Chế độ dev — xác nhận thủ công:" : "Dev mode — manual confirm:"}
          </p>
          <button
            onClick={onDevConfirm}
            className="w-full py-2 text-xs font-semibold rounded-lg"
            style={{
              background: "var(--canvas-soft)",
              color: "var(--primary)",
              border: "1px dashed var(--primary)",
              cursor: "pointer",
            }}
          >
            ✅ {locale === "vi" ? "Xác nhận đã thanh toán (dev)" : "Confirm paid (dev mode)"}
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-2 text-xs"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--mute)",
            cursor: "pointer",
          }}
        >
          {locale === "vi" ? "✕ Huỷ và đóng" : "✕ Cancel"}
        </button>
      </div>
    </div>
  );
}
