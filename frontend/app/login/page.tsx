"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      router.replace("/upload");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] -mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Left Panel — Ink Branding */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden"
        style={{
          background: "var(--ink)",
        }}
      >
        {/* Decorative floating shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="float-anim absolute"
            style={{
              width: 300, height: 300, borderRadius: "50%",
              background: "rgba(159, 232, 112, 0.08)",
              top: "10%", left: "-5%",
            }}
          />
          <div
            className="float-anim-delay absolute"
            style={{
              width: 200, height: 200, borderRadius: "50%",
              background: "rgba(159, 232, 112, 0.06)",
              top: "60%", right: "10%",
            }}
          />
          <div
            className="float-anim-slow absolute"
            style={{
              width: 150, height: 150, borderRadius: "30%",
              background: "rgba(159, 232, 112, 0.05)",
              top: "35%", right: "30%",
              transform: "rotate(45deg)",
            }}
          />
          <div
            className="float-anim absolute"
            style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "rgba(159, 232, 112, 0.04)",
              bottom: "15%", left: "20%",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          {/* AI Shield Icon */}
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
            🛡️
          </div>
          <h2 style={{
            fontSize: "2.5rem", fontWeight: 900,
            letterSpacing: "-0.03em", marginBottom: "0.75rem",
            textAlign: "center",
            color: "var(--primary)",
          }}>
            {t("login.tagline")}
          </h2>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--canvas-soft)",
            opacity: 0.85,
            textAlign: "center", maxWidth: 360,
            lineHeight: 1.6,
          }}>
            {t("login.taglineDesc")}
          </p>

          {/* Stats mini */}
          <div
            style={{
              marginTop: "3rem",
              display: "flex", gap: "2.5rem",
            }}
          >
            {[
              { val: "98.6%", label: "F1 Score" },
              { val: "<200ms", label: "Inference" },
              { val: "4+", label: "Models" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--canvas)" }}>{s.val}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--mute)", marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 py-12"
           style={{ background: "var(--canvas-soft)" }}>
        <div className="w-full max-w-[400px] fade-up">

          {/* Mobile branding (shown only on small screens) */}
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
              {t("login.title")}
            </h1>
            <p style={{ color: "var(--body)", marginTop: "0.5rem", fontSize: "0.9375rem" }}>
              {t("login.subtitle")}
            </p>
          </div>

          <div className="card" style={{ padding: "2rem", borderRadius: "var(--r-xl)" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("login.email")}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                />
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--body)", marginBottom: "0.5rem",
                }}>
                  {t("login.password")}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
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
                {isLoading ? <span className="spinner" /> : t("login.submit")}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: "flex", alignItems: "center", gap: "1rem",
              margin: "1.5rem 0",
            }}>
              <div style={{ flex: 1, height: 1, background: "var(--canvas-soft)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--mute)", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--canvas-soft)" }} />
            </div>

            <p style={{
              textAlign: "center", fontSize: "0.875rem",
              color: "var(--body)",
            }}>
              {t("login.noAccount")}{" "}
              <Link href="/signup" style={{
                color: "var(--primary)", fontWeight: 700,
                textDecoration: "none",
              }}>
                {t("login.signupLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
