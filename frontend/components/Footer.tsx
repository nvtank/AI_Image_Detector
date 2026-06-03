"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--sp-2xl)",
        }}
        className="max-md:grid-cols-2 max-sm:grid-cols-1"
      >
        {/* Brand column */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-sm)",
              marginBottom: "var(--sp-lg)",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--r-sm)",
                background: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--on-primary)",
                fontSize: "0.75rem",
                fontWeight: 900,
              }}
            >
              AI
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--canvas)",
              }}
            >
              Detector
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--mute)",
              lineHeight: 1.6,
              maxWidth: 240,
            }}
          >
            {t("home.subtitle")}
          </p>
        </div>

        {/* Product */}
        <div>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--canvas)",
              marginBottom: "var(--sp-lg)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("nav.product") || "Product"}
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-sm)",
            }}
          >
            <Link href="/upload" style={{ fontSize: 14, color: "var(--mute)" }}>
              {t("nav.upload")}
            </Link>
            <Link
              href="/history"
              style={{ fontSize: 14, color: "var(--mute)" }}
            >
              {t("nav.history")}
            </Link>
            <Link
              href="/dashboard"
              style={{ fontSize: 14, color: "var(--mute)" }}
            >
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>

        {/* Company */}
        <div>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--canvas)",
              marginBottom: "var(--sp-lg)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("nav.company") || "Company"}
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-sm)",
            }}
          >
            <Link href="/about" style={{ fontSize: 14, color: "var(--mute)" }}>
              {t("nav.about")}
            </Link>
          </div>
        </div>

        {/* Get Started */}
        <div>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--canvas)",
              marginBottom: "var(--sp-lg)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("nav.getStarted") || "Get Started"}
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-sm)",
            }}
          >
            <Link href="/login" style={{ fontSize: 14, color: "var(--mute)" }}>
              {t("nav.login")}
            </Link>
            <Link href="/signup" style={{ fontSize: 14, color: "var(--mute)" }}>
              {t("nav.signup")}
            </Link>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          marginTop: "var(--sp-3xl)",
          paddingTop: "var(--sp-xl)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--sp-sm)",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--mute)" }}>
          © {new Date().getFullYear()} AI Image Detector. All rights reserved.
        </p>
        <p style={{ fontSize: 12, color: "var(--mute)" }}>
          Built with PyTorch, FastAPI & Next.js
        </p>
      </div>
    </footer>
  );
}
