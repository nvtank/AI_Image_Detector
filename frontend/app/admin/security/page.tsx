"use client";

/**
 * Admin Monitoring Page — Phase 4 Observability
 * ===============================================
 * Real-time monitoring dashboard using Prometheus metrics.
 * Protected with requireRole="admin" (RBAC guard).
 *
 * Shows:
 *   - Live counters: requests/s, error rate, active connections
 *   - AI inference stats: predictions, latency, agreement status
 *   - Celery queue depth + task throughput
 *   - Security event timeline
 *
 * Data source: GET /security/audit-stats (backend aggregation)
 * Auto-refreshes every 10 seconds.
 */

import React, { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type AuditStats = {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_severity: Record<string, number>;
  top_ips: Array<{ ip: string; count: number }>;
  recent_events: Array<{
    id: number;
    event_type: string;
    severity: string;
    ip_address: string;
    endpoint: string;
    details: string;
    created_at: string;
  }>;
};

const SEVERITY_STYLES: Record<string, React.CSSProperties> = {
  INFO: { color: "#0066cc", background: "rgba(0, 102, 204, 0.08)" },
  WARNING: { color: "var(--warning-deep)", background: "rgba(255, 209, 26, 0.15)" },
  HIGH: { color: "var(--negative-deep)", background: "rgba(208, 50, 56, 0.08)" },
  CRITICAL: { color: "#ffffff", background: "var(--negative)" },
};

const EVENT_ICONS: Record<string, string> = {
  RATE_LIMIT_EXCEEDED: "⚡",
  LOGIN_FAILED: "🔐",
  SUSPICIOUS_REQUEST: "🚨",
  REFRESH_TOKEN_REUSE: "♻️",
  INVALID_FILE_UPLOAD: "📁",
  OVERSIZED_PAYLOAD: "📦",
  DEFAULT: "🔔",
};

function AdminMonitoringContent() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getAuditStats();
      setStats(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch monitoring data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchStats, 10_000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchStats]);

  const totalEvents = stats?.total_events ?? 0;
  const criticalEvents = stats?.events_by_severity?.CRITICAL ?? 0;
  const highEvents = stats?.events_by_severity?.HIGH ?? 0;
  const warningEvents = stats?.events_by_severity?.WARNING ?? 0;
  const infoEvents = stats?.events_by_severity?.INFO ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: "var(--sp-2xl)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.96px", color: "var(--ink)", margin: 0 }}>
            🔒 Security Monitoring
          </h1>
          <p style={{ color: "var(--body)", marginTop: "var(--sp-xs)", fontSize: "0.9375rem", margin: 0 }}>
            Real-time security audit dashboard — Auto-refresh every 10s
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>
            Last update: {lastRefresh.toLocaleTimeString("vi-VN")}
          </span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-md)",
              fontSize: 12,
              fontWeight: 600,
              background: autoRefresh ? "var(--primary-pale)" : "var(--canvas)",
              color: autoRefresh ? "var(--ink-deep)" : "var(--mute)",
              borderColor: autoRefresh ? "var(--primary)" : "var(--canvas-soft)",
            }}
          >
            {autoRefresh ? "⏱ Auto-refresh ON" : "⏸ Auto-refresh OFF"}
          </button>
          <button
            onClick={fetchStats}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-md)",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--canvas)",
              color: "var(--ink)",
            }}
          >
            ↻ Refresh
          </button>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-md)",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--primary)",
              color: "var(--on-primary)",
              border: "none",
              textDecoration: "none",
            }}
          >
            📊 Open Grafana
          </a>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "var(--negative-bg)",
            color: "#fff",
            borderRadius: "var(--r-xl)",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Events (24h)", value: totalEvents, icon: "📋", color: "var(--ink)", bg: "var(--canvas-soft)" },
          { label: "CRITICAL", value: criticalEvents, icon: "🚨", color: "var(--negative)", bg: "rgba(208, 50, 56, 0.08)" },
          { label: "HIGH / WARNING", value: highEvents + warningEvents, icon: "⚠️", color: "var(--warning-content)", bg: "rgba(255, 209, 26, 0.15)" },
          { label: "INFO", value: infoEvents, icon: "ℹ️", color: "var(--body)", bg: "var(--canvas-soft)" },
        ].map(({ label, value, icon, color, bg }) => (
          <div
            key={label}
            className="card"
            style={{ padding: "1.5rem", borderRadius: "var(--r-xl)", display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: color, letterSpacing: "-0.03em" }}>
                {loading ? "—" : value.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--mute)", marginTop: 2, fontWeight: 600 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }} className="max-lg:grid-cols-1">
        {/* Events by Type */}
        <div className="card" style={{ padding: "1.5rem", borderRadius: "var(--r-xl)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Events by Type
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 24, borderRadius: "var(--r-sm)", background: "var(--canvas-soft)", animation: "pulse 1.5s ease infinite" }} />
              ))}
            </div>
          ) : stats?.events_by_type && Object.keys(stats.events_by_type).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {Object.entries(stats.events_by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(stats.events_by_type));
                  const pct = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: 4 }}>
                        <span style={{ color: "var(--body)", display: "flex", alignItems: "center", gap: 6 }}>
                          {EVENT_ICONS[type] ?? EVENT_ICONS.DEFAULT} {type}
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{count}</span>
                      </div>
                      <div style={{ width: "100%", background: "var(--canvas-soft)", borderRadius: "var(--r-pill)", height: 6 }}>
                        <div
                          style={{
                            height: 6,
                            borderRadius: "var(--r-pill)",
                            background: "var(--primary)",
                            width: `${pct}%`,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p style={{ color: "var(--mute)", fontSize: "0.875rem", textAlign: "center", padding: "1rem 0", margin: 0 }}>No events in the last 24h ✓</p>
          )}
        </div>

        {/* Top IPs */}
        <div className="card" style={{ padding: "1.5rem", borderRadius: "var(--r-xl)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Top Source IPs
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 32, borderRadius: "var(--r-sm)", background: "var(--canvas-soft)", animation: "pulse 1.5s ease infinite" }} />
              ))}
            </div>
          ) : stats?.top_ips && stats.top_ips.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {stats.top_ips.slice(0, 8).map(({ ip, count }, idx) => (
                <div
                  key={ip}
                  className="card-inner"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--r-lg)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mute)", width: 16, textAlign: "right" }}>{idx + 1}</span>
                    <code style={{ fontSize: "0.875rem", color: "var(--ink)", fontFamily: "monospace" }}>{ip}</code>
                  </div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary-neutral)" }}>{count} events</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--mute)", fontSize: "0.875rem", textAlign: "center", padding: "1rem 0", margin: 0 }}>No suspicious IPs detected ✓</p>
          )}
        </div>
      </div>

      {/* Recent Events Log */}
      <div className="card" style={{ padding: "1.5rem", borderRadius: "var(--r-xl)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Recent Security Events
        </h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 48, borderRadius: "var(--r-md)", background: "var(--canvas-soft)", animation: "pulse 1.5s ease infinite" }} />
            ))}
          </div>
        ) : stats?.recent_events && stats.recent_events.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
            {stats.recent_events.map((event) => (
              <div
                key={event.id}
                className="card-inner"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--r-lg)",
                }}
              >
                <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>
                  {EVENT_ICONS[event.event_type] ?? EVENT_ICONS.DEFAULT}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--ink)" }}>{event.event_type}</span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "var(--r-sm)",
                        fontSize: 10,
                        fontWeight: 700,
                        ...SEVERITY_STYLES[event.severity],
                      }}
                    >
                      {event.severity}
                    </span>
                    {event.endpoint && (
                      <code style={{ fontSize: 10, color: "var(--mute)", fontFamily: "monospace" }}>{event.endpoint}</code>
                    )}
                  </div>
                  {event.details && (
                    <p style={{ fontSize: "0.75rem", color: "var(--body)", margin: 0, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {event.details}
                    </p>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  {event.ip_address && (
                    <code style={{ fontSize: 10, color: "var(--mute)", fontFamily: "monospace", display: "block" }}>{event.ip_address}</code>
                  )}
                  <span style={{ fontSize: 10, color: "var(--mute)" }}>
                    {new Date(event.created_at).toLocaleTimeString("vi-VN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
            <p style={{ fontWeight: 600, color: "var(--ink)", margin: 0 }}>No security events in the last 24 hours</p>
            <p style={{ color: "var(--mute)", fontSize: "0.8125rem", margin: 0, marginTop: 4 }}>System operating normally</p>
          </div>
        )}
      </div>

      {/* Grafana embed hint */}
      <div
        className="card-dark"
        style={{
          marginTop: "1.5rem",
          padding: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "2rem" }}>📊</span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--primary)", margin: 0 }}>
            Full Metrics Dashboard (Grafana)
          </p>
          <p style={{ fontSize: 13, color: "var(--canvas-soft)", margin: 0, marginTop: 4, lineHeight: 1.5 }}>
            Prometheus collects 20+ metrics every 10s. View inference latency, queue depth, error rates, and prediction distributions in Grafana.
          </p>
        </div>
        <a
          href="http://localhost:3000/d/ai-detector-main"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            flexShrink: 0,
            textDecoration: "none",
            display: "inline-block",
            fontSize: 14,
            fontWeight: 700,
            padding: "10px 18px",
            background: "var(--canvas)",
            color: "var(--ink)",
          }}
        >
          Open Dashboard →
        </a>
      </div>
    </div>
  );
}

export default function AdminMonitoringPage() {
  return (
    <AuthGuard requireRole="admin">
      <AdminMonitoringContent />
    </AuthGuard>
  );
}
