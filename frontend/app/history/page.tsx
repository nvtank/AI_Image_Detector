"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type HistoryItem = {
  id: number;
  source_type: string;
  image_name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  label: string;
  confidence: number;
  fake_probability: number;
  real_probability: number;
  model_name: string;
  processing_time_ms: number;
  created_at: string;
  local_predicted_label?: string | null;
  local_confidence?: number | null;
  gemini_predicted_label?: string | null;
  gemini_confidence_level?: string | null;
  gemini_reasoning_summary?: string | null;
  gemini_visual_signals?: string[] | null;
  gemini_limitations?: string | null;
  agreement_status?: string | null;
  final_decision?: string | null;
  used_gemini?: boolean | null;
};

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f3f3f3'/%3E%3Ctext x='150' y='155' text-anchor='middle' font-size='13' fill='%23aaa'%3ENo image%3C/text%3E%3C/svg%3E";

const FILTER_KEYS = ["All", "Fake", "Real", "Uncertain", "Agree", "Disagree"] as const;

const FILTER_I18N: Record<string, string> = {
  All: "history.filterAll",
  Fake: "history.filterFake",
  Real: "history.filterReal",
  Uncertain: "history.filterUncertain",
  Agree: "history.filterAgree",
  Disagree: "history.filterDisagree",
};

function verdictStyle(v: string): { color: string; bg: string } {
  if (v === 'FAKE') return { color: '#ffffff', bg: 'var(--negative-bg)' };
  if (v === 'REAL') return { color: 'var(--positive-deep)', bg: 'var(--primary-pale)' };
  return { color: 'var(--warning-content)', bg: '#fff8e1' };
}

function HistoryContent() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  useEffect(() => {
    api.getHistory()
      .then(d => setLogs(d))
      .catch(e => setError(e.message || t('history.failedLoad')))
      .finally(() => setIsLoading(false));
  }, []);

  const fmt = (d: string) => {
    const s = d.includes("T") ? d : d.replace(" ", "T") + "Z";
    return new Intl.DateTimeFormat("vi-VN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
  };

  const filtered = logs.filter(l => {
    const v = l.final_decision || l.label;
    if (filter === "All")       return true;
    if (filter === "Fake")      return v === "FAKE";
    if (filter === "Real")      return v === "REAL";
    if (filter === "Uncertain") return v === "UNCERTAIN";
    if (filter === "Agree")     return l.agreement_status === "agree";
    if (filter === "Disagree")  return l.agreement_status === "disagree";
    return true;
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">

      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.96px", color: "var(--ink)" }}>
            {t('history.title')}
          </h1>
          <p style={{ color: "var(--body)", marginTop: "0.35rem", fontSize: "0.9375rem" }}>
            {t('history.subtitle')}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: "flex", gap: 4, flexWrap: "wrap",
          background: "var(--canvas)", border: "none",
          borderRadius: "var(--r-md)", padding: 4,
        }}>
          {FILTER_KEYS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--r-sm)", fontSize: "0.8125rem", fontWeight: filter === f ? 600 : 400,
                background: filter === f ? "var(--primary-pale)" : "transparent",
                color: filter === f ? "var(--ink-deep)" : "var(--mute)",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {t(FILTER_I18N[f])}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ padding: "0.75rem 1rem", background: "var(--canvas)", border: "1px solid var(--canvas-soft)", borderRadius: "var(--r-md)", fontSize: "0.875rem", color: "var(--negative)", marginBottom: "1.5rem" }}>
          {error}
        </p>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--mute)" }}>
          <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--body)" }}>{t('history.noEntries')}</p>
          <p style={{ fontSize: "0.875rem", marginTop: 4 }}>{t('history.noEntriesSub')}</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {filtered.map(log => {
            const v = log.final_decision || log.label;
            const vs = verdictStyle(v);
            return (
              <div
                key={log.id}
                onClick={() => setSelected(log)}
                className="card"
                style={{ borderRadius: "var(--r-xl)", overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.2s ease" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
              >
                {/* Thumbnail */}
                <div style={{ position: "relative", aspectRatio: "1/1", background: "var(--canvas-soft)" }}>
                  <Image
                    src={log.thumbnail_url || log.image_url || PLACEHOLDER}
                    alt={log.image_name || "Image"}
                    fill style={{ objectFit: "cover" }}
                    onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                    unoptimized
                  />
                  {/* Verdict chip */}
                  <span style={{
                    position: "absolute", top: 8, right: 8,
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em",
                    padding: "2px 8px", borderRadius: "var(--r-pill)",
                    background: vs.bg, color: vs.color,
                    border: "none",
                  }}>
                    {v}
                  </span>
                </div>

                {/* Info */}
                <div style={{ padding: "var(--sp-md) var(--sp-lg)" }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.image_name || t('history.untitled')}
                  </p>
                  <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>{(log.confidence * 100).toFixed(0)}% {t('history.conf')}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>{fmt(log.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(14,15,12,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card fade-up"
            style={{ width: "100%", maxWidth: 760, maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", borderRadius: "var(--r-xl)" }}
          >
            {/* Modal header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--canvas-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--canvas)", zIndex: 10, borderRadius: "var(--r-xl) var(--r-xl) 0 0" }}>
              <div>
                <p className="caption" style={{ fontWeight: 600, letterSpacing: "0.06em", color: "var(--mute)", textTransform: "uppercase", marginBottom: 2 }}>
                  {t('history.report')} #{selected.id}
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                  {selected.image_name || t('history.screenCapture')}
                </h3>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: "var(--body)", background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "1.5rem" }} className="max-sm:grid-cols-1">

              {/* Image */}
              <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--canvas-soft)", border: "1px solid var(--canvas-soft)" }}>
                <Image src={selected.image_url || PLACEHOLDER} alt="Full view" fill style={{ objectFit: "contain" }} unoptimized />
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Verdict */}
                <div className="card-inner" style={{ padding: "1rem", borderRadius: "var(--r-lg)" }}>
                  <p className="caption" style={{ fontWeight: 600, letterSpacing: "0.06em", color: "var(--mute)", textTransform: "uppercase", marginBottom: 4 }}>{t('history.finalVerdict')}</p>
                  <p style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                    {selected.final_decision || selected.label}
                  </p>
                  {selected.used_gemini && (
                    <p style={{ fontSize: "0.75rem", color: "var(--body)", marginTop: 4 }}>
                      {selected.agreement_status === "agree" ? t('history.modelsAgreed') : t('history.modelsDisagreed')}
                    </p>
                  )}
                </div>

                {/* Model stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                  {[
                    { label: t('history.localResult'), val: selected.local_predicted_label || selected.label },
                    { label: t('history.confidence'), val: `${((selected.local_confidence || selected.confidence) * 100).toFixed(1)}%` },
                    { label: t('history.geminiOpinion'), val: selected.used_gemini ? (selected.gemini_predicted_label || "N/A") : t('history.off') },
                    { label: t('history.latency'), val: `${selected.processing_time_ms} ms` },
                  ].map(({ label, val }) => (
                    <div key={label} className="card-inner" style={{ padding: "0.75rem", borderRadius: "var(--r-lg)" }}>
                      <p style={{ fontSize: "0.6875rem", color: "var(--mute)", marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)" }}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Gemini reasoning */}
                {selected.used_gemini && selected.gemini_reasoning_summary && (
                  <div className="card-inner" style={{ padding: "0.85rem 1rem", borderRadius: "var(--r-lg)", borderLeft: "3px solid var(--primary)" }}>
                    <p className="caption" style={{ fontWeight: 600, letterSpacing: "0.06em", color: "var(--mute)", textTransform: "uppercase", marginBottom: 6 }}>{t('history.geminiReasoning')}</p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--body)", lineHeight: 1.65 }}>{selected.gemini_reasoning_summary}</p>
                  </div>
                )}

                {/* Visual signals */}
                {selected.gemini_visual_signals && selected.gemini_visual_signals.length > 0 && (
                  <div className="card-inner" style={{ padding: "0.85rem 1rem", borderRadius: "var(--r-lg)", borderLeft: "3px solid var(--accent-cyan)" }}>
                    <p className="caption" style={{ fontWeight: 600, letterSpacing: "0.06em", color: "var(--mute)", textTransform: "uppercase", marginBottom: 8 }}>{t('history.visualSignals')}</p>
                    <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {selected.gemini_visual_signals.map((s, i) => (
                        <li key={i} style={{ fontSize: "0.8125rem", color: "var(--body)", paddingLeft: "0.75rem", borderLeft: "2px solid var(--primary)" }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--canvas-soft)", display: "flex", justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--canvas)", borderRadius: "0 0 var(--r-xl) var(--r-xl)" }}>
              <button onClick={() => setSelected(null)} className="btn-primary">
                {t('history.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return <AuthGuard><HistoryContent /></AuthGuard>;
}
