"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevToken(null);
    setIsLoading(true);

    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      if (res.dev_token) {
        setDevToken(res.dev_token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4">
      <div className="w-full max-w-[440px] fade-up">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{
            fontSize: "1.875rem", fontWeight: 800,
            letterSpacing: "-0.03em", color: "var(--ink)",
          }}>
            {t("forgotPassword.title") || "Quên mật khẩu?"}
          </h1>
          <p style={{ color: "var(--body)", marginTop: "0.5rem", fontSize: "0.9375rem" }}>
            {t("forgotPassword.subtitle") || "Nhập email của bạn để nhận liên kết đặt lại mật khẩu"}
          </p>
        </div>

        <div className="card" style={{ padding: "2rem", borderRadius: "var(--r-xl)" }}>
          {message ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{
                fontSize: "0.875rem", color: "var(--primary-neutral)",
                background: "var(--primary-pale)",
                borderRadius: "var(--r-md)", padding: "1rem",
                textAlign: "center", lineHeight: 1.5,
              }}>
                ✅ {message}
              </div>

              {devToken && (
                <div style={{
                  fontSize: "0.875rem", color: "var(--warning-content)",
                  background: "rgba(255, 209, 26, 0.15)",
                  border: "1px solid rgba(255, 209, 26, 0.3)",
                  borderRadius: "var(--r-md)", padding: "1.25rem 1rem",
                  display: "flex", flexDirection: "column", gap: "0.75rem",
                }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    🛠️ DEV MODE DETECTED:
                  </strong>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Hệ thống chạy local không có SMTP. Link đặt lại mật khẩu:
                  </p>
                  <Link
                    href={`/reset-password?token=${devToken}`}
                    className="btn-primary"
                    style={{
                      padding: "8px 12px",
                      fontSize: "0.8125rem",
                      textAlign: "center",
                      textDecoration: "none",
                      borderRadius: "var(--r-md)",
                      background: "var(--primary)",
                      color: "var(--on-primary)",
                      fontWeight: 700,
                    }}
                  >
                    Click để đổi mật khẩu ngay →
                  </Link>
                </div>
              )}

              <Link href="/login" className="btn-secondary" style={{
                padding: "0.85rem", fontSize: "0.9375rem", borderRadius: "var(--r-xl)",
                textAlign: "center", textDecoration: "none", display: "block"
              }}>
                ← {t("forgotPassword.backToLogin") || "Quay lại đăng nhập"}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder") || "you@example.com"}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: "0.8125rem", color: "var(--negative)",
                  background: "rgba(208, 50, 56, 0.08)",
                  border: "1px solid rgba(208, 50, 56, 0.2)",
                  borderRadius: "var(--r-md)", padding: "0.75rem 1rem",
                  display: "flex", alignItems: "center", gap: "0.5rem",
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary"
                style={{ padding: "0.85rem", fontSize: "0.9375rem", borderRadius: "var(--r-xl)", marginTop: "0.25rem" }}>
                {isLoading ? <span className="spinner" /> : (t("forgotPassword.submit") || "Gửi yêu cầu")}
              </button>

              <p style={{ textAlign: "center", fontSize: "0.875rem", margin: 0 }}>
                <Link href="/login" style={{
                  color: "var(--body)", fontWeight: 600,
                  textDecoration: "none",
                }}>
                  ← {t("forgotPassword.backToLogin") || "Quay lại đăng nhập"}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
