"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  const stats = [
    { label: t("home.statCleanF1"), value: "98.6%" },
    { label: t("home.statRobustF1"), value: "98.1%" },
    { label: t("home.statModels"), value: "4" },
    { label: t("home.statInference"), value: "<200ms" },
  ];

  const features = [
    { icon: "🧠", title: t("home.feat1Title"), desc: t("home.feat1Desc") },
    { icon: "🔍", title: t("home.feat2Title"), desc: t("home.feat2Desc") },
    { icon: "🌐", title: t("home.feat3Title"), desc: t("home.feat3Desc") },
    { icon: "⚡", title: t("home.feat4Title"), desc: t("home.feat4Desc") },
    { icon: "📊", title: t("home.feat5Title"), desc: t("home.feat5Desc") },
    { icon: "🔒", title: t("home.feat6Title"), desc: t("home.feat6Desc") },
  ];

  const howSteps = [
    { n: "01", icon: "📤", title: t("home.how1Title"), desc: t("home.how1Desc") },
    { n: "02", icon: "⚙️", title: t("home.how2Title"), desc: t("home.how2Desc") },
    { n: "03", icon: "🧠", title: t("home.how3Title"), desc: t("home.how3Desc") },
    { n: "04", icon: "✨", title: t("home.how4Title"), desc: t("home.how4Desc") },
    { n: "05", icon: "🎯", title: t("home.how5Title"), desc: t("home.how5Desc") },
  ];

  const techStack = [
    { name: "PyTorch", icon: "🔥", color: "#ee4c2c" },
    { name: "FastAPI", icon: "⚡", color: "#009688" },
    { name: "Next.js", icon: "▲", color: "#000000" },
    { name: "Tailwind", icon: "🎨", color: "#38bdf8" },
    { name: "Docker", icon: "🐳", color: "#2496ed" },
    { name: "Gemini", icon: "✨", color: "#8b5cf6" },
    { name: "Chrome Ext", icon: "🌐", color: "#4285f4" },
    { name: "SQLite", icon: "🗄️", color: "#003b57" },
  ];

  return (
    <div style={{ overflow: "hidden" }}>
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="flex flex-col items-center justify-center min-h-[75vh] text-center fade-up"
        style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>

        {/* Badge */}
        <div className="fade-up" style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          color: "var(--accent)", fontSize: "0.8125rem", fontWeight: 600,
          border: "1px solid var(--border)",
          background: "var(--accent-light)",
          borderRadius: 99, padding: "0.35rem 1rem", marginBottom: "2rem",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--success)", flexShrink: 0,
          }} className="pulse-glow" />
          {t("home.badge")}
        </div>

        {/* Headline */}
        <h1 className="fade-up-delay-1" style={{
          fontSize: "clamp(3rem, 8vw, 5.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.05,
          marginBottom: "1.5rem",
        }}>
          <span className="text-shimmer">{t("home.title")}</span>
          <br />
          <span style={{ color: "var(--text-1)" }}>{t("home.titleLine2")}</span>
        </h1>

        <p className="fade-up-delay-2" style={{
          fontSize: "1.25rem",
          color: "var(--text-3)",
          maxWidth: 520,
          lineHeight: 1.65,
          marginBottom: "2.5rem",
        }}>
          {t("home.subtitle")}
        </p>

        {/* CTAs */}
        <div className="fade-up-delay-3" style={{
          display: "flex", gap: "0.85rem", flexWrap: "wrap",
          justifyContent: "center", marginBottom: "4rem",
        }}>
          <Link href="/upload" className="btn-primary"
            style={{ padding: "0.85rem 2rem", fontSize: "1rem" }}>
            {t("home.ctaTry")} →
          </Link>
          <Link href="/dashboard" className="btn-ghost"
            style={{ padding: "0.85rem 2rem", fontSize: "1rem" }}>
            {t("home.ctaBenchmark")}
          </Link>
        </div>

        {/* Stats */}
        <div className="fade-up-delay-4" style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          width: "100%",
          maxWidth: 640,
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "var(--bg)", padding: "1.5rem 1rem" }}>
              <p className="gradient-text" style={{
                fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em",
              }}>
                {s.value}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-4)", marginTop: 4 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ FEATURES SECTION ═══════════════ */}
      <section className="section-padding">
        <div className="text-center mb-12 fade-up">
          <h2 style={{
            fontSize: "2.25rem", fontWeight: 800,
            letterSpacing: "-0.03em", color: "var(--text-1)",
            marginBottom: "0.75rem",
          }}>
            {t("home.featuresTitle")}
          </h2>
          <p style={{ fontSize: "1.125rem", color: "var(--text-3)", maxWidth: 500, margin: "0 auto" }}>
            {t("home.featuresSubtitle")}
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1.25rem",
        }}
        className="max-lg:grid-cols-2 max-sm:grid-cols-1"
        >
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`card fade-up-delay-${Math.min(i + 1, 5)}`}
              style={{
                padding: "2rem",
                cursor: "default",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "var(--accent-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", marginBottom: "1.25rem",
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: "1.0625rem", fontWeight: 700,
                color: "var(--text-1)", marginBottom: "0.5rem",
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: "0.875rem", color: "var(--text-3)",
                lineHeight: 1.65,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ ARCHITECTURE SECTION ═══════════════ */}
      <section className="section-padding">
        <div className="text-center mb-12 fade-up">
          <h2 style={{
            fontSize: "2.25rem", fontWeight: 800,
            letterSpacing: "-0.03em", color: "var(--text-1)",
            marginBottom: "0.75rem",
          }}>
            {t("home.archTitle")}
          </h2>
          <p style={{ fontSize: "1.125rem", color: "var(--text-3)", maxWidth: 520, margin: "0 auto" }}>
            {t("home.archSubtitle")}
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="card fade-up-delay-1" style={{
          padding: "3rem 2rem",
          maxWidth: 900, margin: "0 auto",
          overflow: "hidden",
        }}>
          {/* Row 1: User → Backend */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "1rem", flexWrap: "wrap", marginBottom: "2rem",
          }}>
            <ArchNode icon="👤" label={t("home.archUser")} sub={t("home.archUpload")} color="#6366f1" />
            <ArchArrow />
            <ArchNode icon="🖥️" label={t("home.archBackend")} sub={t("home.archPreprocess")} color="#8b5cf6" large />
          </div>

          {/* Row 2: Two parallel paths */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem", marginBottom: "2rem",
            maxWidth: 600, margin: "0 auto 2rem",
          }}
          className="max-sm:grid-cols-1"
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <ArchArrowDown />
              <ArchNode icon="🧠" label={t("home.archLocal")} sub={t("home.archLocalDesc")} color="#4f46e5" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <ArchArrowDown />
              <ArchNode icon="✨" label={t("home.archGemini")} sub={t("home.archGeminiDesc")} color="#7c3aed" />
            </div>
          </div>

          {/* Row 3: Hybrid → Result */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "1rem", flexWrap: "wrap",
          }}>
            <ArchArrowDown />
          </div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "1rem", flexWrap: "wrap", marginTop: "0.75rem",
          }}>
            <ArchNode icon="⚡" label={t("home.archHybrid")} sub="" color="#6366f1" large />
            <ArchArrow />
            <ArchNode icon="📊" label={t("home.archResult")} sub="" color="#10b981" />
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="section-padding">
        <div className="text-center mb-12 fade-up">
          <h2 style={{
            fontSize: "2.25rem", fontWeight: 800,
            letterSpacing: "-0.03em", color: "var(--text-1)",
            marginBottom: "0.75rem",
          }}>
            {t("home.howTitle")}
          </h2>
          <p style={{ fontSize: "1.125rem", color: "var(--text-3)", maxWidth: 480, margin: "0 auto" }}>
            {t("home.howSubtitle")}
          </p>
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: "1.5rem",
          maxWidth: 700, margin: "0 auto",
        }}>
          {howSteps.map((step, i) => (
            <div
              key={step.n}
              className={`card fade-up-delay-${Math.min(i + 1, 5)}`}
              style={{
                display: "flex", alignItems: "flex-start", gap: "1.25rem",
                padding: "1.75rem 2rem",
              }}
            >
              {/* Step number */}
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "0.875rem", fontWeight: 800,
                flexShrink: 0,
              }}>
                {step.n}
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.0625rem", fontWeight: 700,
                  color: "var(--text-1)", marginBottom: "0.35rem",
                  display: "flex", alignItems: "center", gap: "0.5rem",
                }}>
                  <span>{step.icon}</span> {step.title}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-3)", lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ TECH STACK ═══════════════ */}
      <section className="section-padding">
        <div className="text-center mb-12 fade-up">
          <h2 style={{
            fontSize: "2.25rem", fontWeight: 800,
            letterSpacing: "-0.03em", color: "var(--text-1)",
            marginBottom: "0.75rem",
          }}>
            {t("home.techTitle")}
          </h2>
          <p style={{ fontSize: "1.125rem", color: "var(--text-3)", maxWidth: 480, margin: "0 auto" }}>
            {t("home.techSubtitle")}
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          maxWidth: 700, margin: "0 auto",
        }}
        className="max-sm:grid-cols-2"
        >
          {techStack.map((tech, i) => (
            <div
              key={tech.name}
              className={`card fade-up-delay-${Math.min(i + 1, 5)}`}
              style={{
                padding: "1.5rem 1rem",
                textAlign: "center",
                cursor: "default",
              }}
            >
              <div style={{
                fontSize: "2rem", marginBottom: "0.5rem",
              }}>
                {tech.icon}
              </div>
              <p style={{
                fontSize: "0.8125rem", fontWeight: 700,
                color: "var(--text-1)",
              }}>
                {tech.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ CTA FOOTER ═══════════════ */}
      <section className="section-padding fade-up" style={{ textAlign: "center" }}>
        <div style={{
          background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
          borderRadius: 24, padding: "4rem 2rem",
          maxWidth: 800, margin: "0 auto",
        }}>
          <h2 style={{
            fontSize: "2rem", fontWeight: 800,
            color: "#ffffff", letterSpacing: "-0.02em",
            marginBottom: "0.75rem",
          }}>
            {t("home.ctaFooterTitle")}
          </h2>
          <p style={{
            fontSize: "1.125rem", color: "rgba(255,255,255,0.8)",
            maxWidth: 420, margin: "0 auto 2rem",
            lineHeight: 1.6,
          }}>
            {t("home.ctaFooterSubtitle")}
          </p>
          <Link href="/signup" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "0.85rem 2.5rem",
            background: "#ffffff",
            color: "var(--gradient-start)",
            fontWeight: 700, fontSize: "1rem",
            borderRadius: 14, border: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            transition: "all 0.2s ease",
            textDecoration: "none",
          }}>
            {t("home.ctaFooterBtn")} →
          </Link>
        </div>
      </section>

      {/* Bottom spacer */}
      <div style={{ height: "2rem" }} />
    </div>
  );
}

/* ── Architecture Diagram Sub-components ── */

function ArchNode({ icon, label, sub, color, large }: {
  icon: string; label: string; sub: string; color: string; large?: boolean;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "0.5rem", textAlign: "center",
      padding: large ? "1.25rem 2rem" : "1rem 1.5rem",
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: 16,
      minWidth: large ? 180 : 140,
    }}>
      <span style={{ fontSize: large ? "1.75rem" : "1.5rem" }}>{icon}</span>
      <div>
        <p style={{
          fontSize: large ? "0.875rem" : "0.8125rem",
          fontWeight: 700, color: "var(--text-1)",
        }}>
          {label}
        </p>
        {sub && (
          <p style={{ fontSize: "0.6875rem", color: "var(--text-4)", marginTop: 2 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function ArchArrow() {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      color: "var(--accent)", fontSize: "1.25rem", fontWeight: 700,
    }}>
      →
    </div>
  );
}

function ArchArrowDown() {
  return (
    <div style={{
      display: "flex", justifyContent: "center",
      color: "var(--accent)", fontSize: "1.25rem", fontWeight: 700,
    }}>
      ↓
    </div>
  );
}
