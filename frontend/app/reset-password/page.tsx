"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const tParam = searchParams.get("token");
    if (tParam) {
      setToken(tParam);
    }
  }, [searchParams]);

  // Password strength logic
  const isLengthValid = newPassword.length >= 8;
  const hasDigit = anyDigit(newPassword);

  function anyDigit(str: string): boolean {
    return /\d/.test(str);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Thiếu mã xác thực (token). Vui lòng kiểm tra lại liên kết trong email.");
      return;
    }

    if (!isLengthValid) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (!hasDigit) {
      setError("Mật khẩu phải chứa ít nhất 1 chữ số.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không trùng khớp.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.resetPassword(token, newPassword);
      setMessage(res.message);
      // Automatically redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
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
            {t("resetPassword.title") || "Đặt lại mật khẩu"}
          </h1>
          <p style={{ color: "var(--body)", marginTop: "0.5rem", fontSize: "0.9375rem" }}>
            {t("resetPassword.subtitle") || "Nhập mật khẩu mới cho tài khoản của bạn"}
          </p>
        </div>

        <div className="card" style={{ padding: "2rem", borderRadius: "var(--r-xl)" }}>
          {message ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "center" }}>
              <div style={{
                fontSize: "0.875rem", color: "var(--primary-neutral)",
                background: "var(--primary-pale)",
                borderRadius: "var(--r-md)", padding: "1.25rem 1rem",
                lineHeight: 1.5,
              }}>
                ✅ {message}
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--mute)" }}>
                  Tự động chuyển hướng về trang đăng nhập sau 3 giây...
                </p>
              </div>
              <Link href="/login" className="btn-primary" style={{
                padding: "0.85rem", fontSize: "0.9375rem", borderRadius: "var(--r-xl)",
                textDecoration: "none", display: "block"
              }}>
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  Mã Token đặt lại
                </label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập hoặc dán mã token"
                />
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                />
                
                {/* Requirements check indicators */}
                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ fontSize: "0.75rem", color: isLengthValid ? "var(--primary-neutral)" : "var(--mute)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{isLengthValid ? "✓" : "○"}</span> Tối thiểu 8 ký tự
                  </div>
                  <div style={{ fontSize: "0.75rem", color: hasDigit ? "var(--primary-neutral)" : "var(--mute)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{hasDigit ? "✓" : "○"}</span> Chứa ít nhất 1 chữ số
                  </div>
                </div>
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
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
                {isLoading ? <span className="spinner" /> : "Xác nhận đặt lại mật khẩu"}
              </button>

              <p style={{ textAlign: "center", fontSize: "0.875rem", margin: 0 }}>
                <Link href="/login" style={{
                  color: "var(--body)", fontWeight: 600,
                  textDecoration: "none",
                }}>
                  ← Quay lại đăng nhập
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
