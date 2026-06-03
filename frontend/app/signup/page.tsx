"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 5);
  })();

  const strengthColors = [
    "var(--negative)",
    "var(--accent-orange)",
    "var(--warning)",
    "var(--positive)",
    "var(--positive-deep)",
  ];
  const strengthColor = strengthColors[Math.max(0, passwordStrength - 1)] || "var(--canvas-soft)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t("signup.passwordMin")); return; }
    if (password !== confirmPassword) { setError(t("signup.passwordMismatch")); return; }
    setIsLoading(true);
    try {
      await signup(fullName, email, password);
      router.replace("/upload");
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] -mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Left Panel — Signup Form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 py-12"
           style={{ background: "var(--canvas-soft)" }}>
        <div className="w-full max-w-[420px] fade-up">

          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: "0 auto 1rem",
              background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--on-primary)", fontSize: "1.25rem", fontWeight: 800,
            }}>
              AI
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h1 style={{
              fontSize: "1.875rem", fontWeight: 800,
              letterSpacing: "-0.03em", color: "var(--ink)",
            }}>
              {t("signup.title")}
            </h1>
            <p style={{ color: "var(--body)", marginTop: "0.5rem", fontSize: "0.9375rem" }}>
              {t("signup.subtitle")}
            </p>
          </div>

          <div className="card" style={{ padding: "2rem", borderRadius: "var(--r-xl)" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("signup.fullName")}
                </label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder={t("signup.fullNamePlaceholder")} />
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("signup.email")}
                </label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t("signup.emailPlaceholder")} />
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("signup.password")}
                </label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t("signup.passwordPlaceholder")} />
                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 4, borderRadius: "var(--r-pill)",
                          background: i <= passwordStrength ? strengthColor : "var(--canvas-soft)",
                          transition: "all 0.3s ease",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("signup.confirmPassword")}
                </label>
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t("signup.confirmPasswordPlaceholder")} />
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
                {isLoading ? <span className="spinner" /> : t("signup.submit")}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--canvas-soft)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--mute)", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--canvas-soft)" }} />
            </div>

            <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--body)" }}>
              {t("signup.hasAccount")}{" "}
              <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                {t("signup.loginLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel — Ink Branding */}
      <div
        className="hidden lg:flex lg:w-[50%] relative overflow-hidden"
        style={{
          background: "var(--ink)",
        }}
      >
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="float-anim absolute"
            style={{
              width: 280, height: 280, borderRadius: "50%",
              background: "rgba(159, 232, 112, 0.08)",
              bottom: "5%", right: "-8%",
            }}
          />
          <div
            className="float-anim-delay absolute"
            style={{
              width: 180, height: 180, borderRadius: "50%",
              background: "rgba(159, 232, 112, 0.06)",
              top: "15%", left: "10%",
            }}
          />
          <div
            className="float-anim-slow absolute"
            style={{
              width: 120, height: 120, borderRadius: "30%",
              background: "rgba(159, 232, 112, 0.05)",
              top: "50%", right: "25%",
              transform: "rotate(45deg)",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          <div
            className="pulse-glow mb-8"
            style={{
              width: 80, height: 80, borderRadius: 20,
              background: "rgba(159, 232, 112, 0.15)",
              backdropFilter: "blur(10px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2.5rem",
            }}
          >
            🚀
          </div>
          <h2 style={{
            fontSize: "2.5rem", fontWeight: 900,
            letterSpacing: "-0.03em", marginBottom: "0.75rem",
            textAlign: "center",
            color: "var(--primary)",
          }}>
            {t("signup.tagline")}
          </h2>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--canvas-soft)",
            opacity: 0.85,
            textAlign: "center", maxWidth: 340,
            lineHeight: 1.6,
          }}>
            {t("signup.taglineDesc")}
          </p>

          {/* Features mini list */}
          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { icon: "🧠", text: "Deep Learning + Gemini AI" },
              { icon: "🔍", text: "Grad-CAM Explainability" },
              { icon: "⚡", text: "Real-time < 200ms" },
            ].map((item) => (
              <div key={item.text} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                background: "rgba(159, 232, 112, 0.1)",
                backdropFilter: "blur(8px)",
                borderRadius: "var(--r-md)", padding: "0.75rem 1.25rem",
              }}>
                <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
                <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--canvas)" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
