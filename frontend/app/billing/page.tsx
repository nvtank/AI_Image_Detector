"use client";

import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";

type CheckoutItem = {
  type: "upgrade" | "refill";
  name: string;
  price: string;
  value: string | number;
};

export default function BillingPage() {
  return (
    <AuthGuard>
      <BillingContent />
    </AuthGuard>
  );
}

function BillingContent() {
  const { user, refreshUser } = useAuth();
  const { t, locale } = useLanguage();
  const [checkoutItem, setCheckoutItem] = useState<CheckoutItem | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Format card number with spaces (e.g. 1111 2222 3333 4444)
  const handleCardNumberChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 16);
    const matches = clean.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(" "));
    } else {
      setCardNumber(clean);
    }
  };

  // Format expiry input (e.g. MM/YY)
  const handleExpiryChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    if (clean.length >= 2) {
      setExpiry(`${clean.slice(0, 2)}/${clean.slice(2, 4)}`);
    } else {
      setExpiry(clean);
    }
  };

  // Initiate purchase
  const handleCheckoutStart = (type: "upgrade" | "refill", name: string, price: string, value: string | number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCheckoutItem({ type, name, price, value });
  };

  // Confirm payment & call API
  const handlePaymentConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutItem) return;

    if (cardNumber.replace(/\s/g, "").length < 16) {
      setErrorMsg(locale === "vi" ? "Số thẻ không hợp lệ (yêu cầu 16 chữ số)." : "Invalid card number (16 digits required).");
      return;
    }
    if (expiry.length < 5) {
      setErrorMsg(locale === "vi" ? "Hạn sử dụng không hợp lệ (yêu cầu MM/YY)." : "Invalid expiry date (MM/YY required).");
      return;
    }
    if (cvv.length < 3) {
      setErrorMsg(locale === "vi" ? "Mã CVV không hợp lệ (tối thiểu 3 chữ số)." : "Invalid CVV (min 3 digits required).");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    // Simulate secure processor authorization delay
    setTimeout(async () => {
      try {
        if (checkoutItem.type === "upgrade") {
          await api.upgradeSubscription(checkoutItem.value as "free" | "plus" | "pro");
          await refreshUser();
          setSuccessMsg(
            t("billing.upgradeSuccess").replace("{tier}", checkoutItem.name)
          );
        } else {
          await api.buyTokens(Number(checkoutItem.value));
          await refreshUser();
          setSuccessMsg(t("billing.refillSuccess"));
        }
        setCheckoutItem(null);
        setCardNumber("");
        setExpiry("");
        setCvv("");
      } catch (err: any) {
        setErrorMsg(err.message || "Payment failed.");
      } finally {
        setIsProcessing(false);
      }
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 px-4">
      {/* Header */}
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

      {/* Success Notification Banner */}
      {successMsg && (
        <div
          className="p-4 mb-8 text-center"
          style={{
            background: "var(--positive-pale)",
            border: "1px solid var(--positive-soft)",
            borderRadius: "var(--r-xl)",
            color: "var(--positive)",
            fontWeight: 600,
            animation: "fadeUp 0.3s ease-out",
          }}
        >
          🎉 {successMsg}
        </div>
      )}

      {/* Grid: Current Balance & Refills */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 items-stretch">
        {/* Card 1: Current Status */}
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
              <h2
                style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", textTransform: "capitalize" }}
              >
                {user?.subscription_tier === "pro"
                  ? t("billing.proPlan")
                  : user?.subscription_tier === "plus"
                    ? t("billing.plusPlan")
                    : t("billing.freePlan")}
              </h2>
              <span className="badge-positive text-xs">{t("billing.active")}</span>
            </div>
          </div>

          <div
            className="p-5 mt-auto rounded-xl"
            style={{
              background: user?.subscription_tier === "pro"
                ? "linear-gradient(135deg, var(--primary-pale), var(--canvas-soft))"
                : "var(--canvas-soft)",
              border: "1px solid var(--canvas-soft)",
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 32 }}>🪙</span>
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {user?.subscription_tier === "pro"
                    ? t("billing.unlimitedTokens")
                    : `${user?.tokens ?? 0} ${t("billing.tokensRemaining")}`}
                </span>
                <span className="text-xs block" style={{ color: "var(--mute)" }}>
                  {user?.subscription_tier === "free"
                    ? (locale === "vi" ? "Chỉ phân tích bằng Local model" : "Local model only")
                    : user?.subscription_tier === "plus"
                      ? (locale === "vi" ? "Có ý kiến chéo từ Gemini" : "Gemini opinion enabled")
                      : (locale === "vi" ? "Full tính năng + Hàng đợi Celery" : "All features + Celery queue unlocked")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Token Pack refills */}
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
              {t("billing.buyTokensSubtitle")}
            </p>
          </div>

          <button
            onClick={() => handleCheckoutStart("refill", t("billing.buy20Tokens"), "$0.99", 20)}
            className="btn-primary w-full text-center py-3 flex items-center justify-center gap-2"
            disabled={user?.subscription_tier === "pro"}
            style={{
              borderRadius: "var(--r-xl)",
              opacity: user?.subscription_tier === "pro" ? 0.4 : 1,
              cursor: user?.subscription_tier === "pro" ? "not-allowed" : "pointer",
            }}
          >
            <span>⚡</span>
            <span>{t("billing.buy20Tokens")} — $0.99</span>
          </button>
        </div>
      </div>

      {/* Plans Comparison */}
      <h3
        style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", textAlign: "center" }}
        className="mb-8"
      >
        {locale === "vi" ? "Chọn gói dịch vụ" : "Choose Your Subscription Plan"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* FREE PLAN */}
        <div
          className="card p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg"
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--canvas)",
            border: user?.subscription_tier === "free" ? "2px solid var(--primary)" : "1px solid var(--canvas-soft)",
            position: "relative",
          }}
        >
          {user?.subscription_tier === "free" && (
            <span
              className="absolute top-3 right-3 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded"
              style={{ background: "var(--primary-pale)", color: "var(--primary)" }}
            >
              {locale === "vi" ? "Hiện tại" : "Current"}
            </span>
          )}
          <div>
            <h4 style={{ fontWeight: 800, color: "var(--ink)" }} className="text-lg mb-1">
              {t("billing.freePlan")}
            </h4>
            <p className="text-xs mb-4" style={{ color: "var(--mute)" }}>
              {t("billing.freePlanDesc")}
            </p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-2xl font-black" style={{ color: "var(--ink)" }}>$0</span>
              <span className="text-xs" style={{ color: "var(--mute)" }}>{t("billing.monthly")}</span>
            </div>
            <ul className="text-xs space-y-2.5 mb-8" style={{ color: "var(--body)" }}>
              <li className="flex items-center gap-2">✅ <span>5 tokens</span></li>
              <li className="flex items-center gap-2">✅ <span>Local Model (EfficientNetV2)</span></li>
              <li className="flex items-center gap-2" style={{ opacity: 0.4 }}>❌ <span>{t("billing.unlockedGemini")}</span></li>
              <li className="flex items-center gap-2" style={{ opacity: 0.4 }}>❌ <span>{t("billing.unlockedAsync")}</span></li>
            </ul>
          </div>

          <button
            className="btn-primary w-full text-center py-2 text-xs"
            disabled={true}
            style={{
              borderRadius: "var(--r-md)",
              background: "var(--canvas-soft)",
              color: "var(--mute)",
              border: "none",
              cursor: "not-allowed",
            }}
          >
            {t("billing.currentPlanBtn")}
          </button>
        </div>

        {/* PLUS PLAN */}
        <div
          className="card p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg"
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--canvas)",
            border: user?.subscription_tier === "plus" ? "2px solid var(--primary)" : "1px solid var(--canvas-soft)",
            position: "relative",
          }}
        >
          {user?.subscription_tier === "plus" && (
            <span
              className="absolute top-3 right-3 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded"
              style={{ background: "var(--primary-pale)", color: "var(--primary)" }}
            >
              {locale === "vi" ? "Hiện tại" : "Current"}
            </span>
          )}
          <div>
            <h4 style={{ fontWeight: 800, color: "var(--ink)" }} className="text-lg mb-1">
              {t("billing.plusPlan")}
            </h4>
            <p className="text-xs mb-4" style={{ color: "var(--mute)" }}>
              {t("billing.plusPlanDesc")}
            </p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-2xl font-black" style={{ color: "var(--ink)" }}>$1.99</span>
              <span className="text-xs" style={{ color: "var(--mute)" }}>{t("billing.monthly")}</span>
            </div>
            <ul className="text-xs space-y-2.5 mb-8" style={{ color: "var(--body)" }}>
              <li className="flex items-center gap-2">✅ <span>100 tokens / {locale === "vi" ? "tháng" : "month"}</span></li>
              <li className="flex items-center gap-2">✅ <span>Local Model (EfficientNetV2)</span></li>
              <li className="flex items-center gap-2">✅ <span>{t("billing.unlockedGemini")}</span></li>
              <li className="flex items-center gap-2" style={{ opacity: 0.4 }}>❌ <span>{t("billing.unlockedAsync")}</span></li>
            </ul>
          </div>

          <button
            onClick={() => handleCheckoutStart("upgrade", t("billing.plusPlan"), "$1.99", "plus")}
            className="btn-primary w-full text-center py-2 text-xs"
            disabled={user?.subscription_tier === "plus" || user?.subscription_tier === "pro"}
            style={{
              borderRadius: "var(--r-md)",
              opacity: (user?.subscription_tier === "plus" || user?.subscription_tier === "pro") ? 0.4 : 1,
              cursor: (user?.subscription_tier === "plus" || user?.subscription_tier === "pro") ? "not-allowed" : "pointer",
            }}
          >
            {user?.subscription_tier === "plus"
              ? t("billing.currentPlanBtn")
              : user?.subscription_tier === "pro"
                ? (locale === "vi" ? "Đã nâng cấp gói cao hơn" : "Downgrade locked")
                : t("billing.upgradeBtn")}
          </button>
        </div>

        {/* PRO PLAN */}
        <div
          className="card p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg"
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--canvas)",
            border: user?.subscription_tier === "pro" ? "2px solid var(--primary)" : "1px solid var(--canvas-soft)",
            boxShadow: user?.subscription_tier === "pro" ? "0 4px 20px rgba(124, 58, 237, 0.15)" : "none",
            position: "relative",
          }}
        >
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] uppercase font-black px-2 py-0.5 rounded text-white"
            style={{ background: "linear-gradient(135deg, var(--warning-content), var(--primary))", letterSpacing: "1px" }}
          >
            ⭐ {locale === "vi" ? "Khuyên dùng" : "Recommended"} ⭐
          </span>
          {user?.subscription_tier === "pro" && (
            <span
              className="absolute top-3 right-3 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded"
              style={{ background: "var(--primary-pale)", color: "var(--primary)" }}
            >
              {locale === "vi" ? "Hiện tại" : "Current"}
            </span>
          )}
          <div>
            <h4 style={{ fontWeight: 800, color: "var(--ink)" }} className="text-lg mb-1">
              {t("billing.proPlan")}
            </h4>
            <p className="text-xs mb-4" style={{ color: "var(--mute)" }}>
              {t("billing.proPlanDesc")}
            </p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-2xl font-black" style={{ color: "var(--ink)" }}>$5.99</span>
              <span className="text-xs" style={{ color: "var(--mute)" }}>{t("billing.monthly")}</span>
            </div>
            <ul className="text-xs space-y-2.5 mb-8" style={{ color: "var(--body)" }}>
              <li className="flex items-center gap-2">✅ <span>{t("billing.unlimitedTokens")}</span></li>
              <li className="flex items-center gap-2">✅ <span>Local Model (EfficientNetV2)</span></li>
              <li className="flex items-center gap-2">✅ <span>{t("billing.unlockedGemini")}</span></li>
              <li className="flex items-center gap-2">✅ <span>{t("billing.unlockedAsync")}</span></li>
            </ul>
          </div>

          <button
            onClick={() => handleCheckoutStart("upgrade", t("billing.proPlan"), "$5.99", "pro")}
            className="btn-primary w-full text-center py-2 text-xs"
            disabled={user?.subscription_tier === "pro"}
            style={{
              borderRadius: "var(--r-md)",
              opacity: user?.subscription_tier === "pro" ? 0.4 : 1,
              cursor: user?.subscription_tier === "pro" ? "not-allowed" : "pointer",
            }}
          >
            {user?.subscription_tier === "pro" ? t("billing.currentPlanBtn") : t("billing.upgradeBtn")}
          </button>
        </div>
      </div>

      {/* Mock Checkout Modal */}
      {checkoutItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="card p-8 w-full max-w-md"
            style={{
              background: "var(--canvas)",
              borderRadius: "var(--r-xl)",
              border: "1px solid var(--canvas-soft)",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                {t("billing.checkoutTitle")}
              </h3>
              <button
                onClick={() => setCheckoutItem(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "var(--mute)",
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Message inside modal */}
            {errorMsg && (
              <div
                className="p-3 mb-4 text-xs font-semibold rounded-lg"
                style={{ background: "var(--negative-pale)", color: "var(--negative)" }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Order details summary */}
            <div
              className="p-4 mb-6 text-xs flex justify-between"
              style={{ background: "var(--canvas-soft)", borderRadius: "var(--r-md)" }}
            >
              <div>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {checkoutItem.name}
                </span>
                <span className="block" style={{ color: "var(--mute)" }}>
                  {checkoutItem.type === "upgrade"
                    ? (locale === "vi" ? "Đăng ký gói cước mới" : "Monthly plan subscription")
                    : (locale === "vi" ? "Gói 20 lượt phân tích" : "Refill pack of 20 credits")}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
                {checkoutItem.price}
              </div>
            </div>

            <form onSubmit={handlePaymentConfirm} className="space-y-4">
              <div>
                <label className="text-xs block mb-1 font-bold" style={{ color: "var(--mute)" }}>
                  {t("billing.cardNumber")}
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="1111 2222 3333 4444"
                  required
                  disabled={isProcessing}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--canvas-soft)",
                    background: "var(--canvas-soft)",
                    color: "var(--ink)",
                    fontSize: 14,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs block mb-1 font-bold" style={{ color: "var(--mute)" }}>
                    {t("billing.expiry")}
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => handleExpiryChange(e.target.value)}
                    placeholder="MM/YY"
                    required
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--canvas-soft)",
                      background: "var(--canvas-soft)",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1 font-bold" style={{ color: "var(--mute)" }}>
                    {t("billing.cvv")}
                  </label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    required
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--canvas-soft)",
                      background: "var(--canvas-soft)",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3.5 text-sm font-bold flex justify-center items-center gap-2 mt-6"
                disabled={isProcessing}
                style={{ borderRadius: "var(--r-xl)", position: "relative" }}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t("billing.processing")}</span>
                  </>
                ) : (
                  <>
                    <span>🔒</span>
                    <span>{t("billing.payBtn")}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
