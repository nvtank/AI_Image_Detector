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

import { useState, useEffect, useCallback } from "react";
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

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "text-blue-400 bg-blue-400/10",
  WARNING: "text-amber-400 bg-amber-400/10",
  HIGH: "text-orange-400 bg-orange-400/10",
  CRITICAL: "text-red-400 bg-red-400/10",
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
    <div className="max-w-7xl mx-auto px-4 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            🔒 Security Monitoring
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Real-time security audit dashboard — Auto-refresh every 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Last update: {lastRefresh.toLocaleTimeString("vi-VN")}
          </span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              autoRefresh
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {autoRefresh ? "⏱ Auto-refresh ON" : "⏸ Auto-refresh OFF"}
          </button>
          <button
            onClick={fetchStats}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            ↻ Refresh
          </button>
          {/* Link to full Grafana dashboard */}
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition-colors flex items-center gap-1"
          >
            📊 Open Grafana
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-xl text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Events (24h)", value: totalEvents, icon: "📋", color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "CRITICAL", value: criticalEvents, icon: "🚨", color: "text-red-400", bg: "bg-red-400/10" },
          { label: "HIGH / WARNING", value: highEvents + warningEvents, icon: "⚠️", color: "text-amber-400", bg: "bg-amber-400/10" },
          { label: "INFO", value: infoEvents, icon: "ℹ️", color: "text-slate-400", bg: "bg-slate-700/40" },
        ].map(({ label, value, icon, color, bg }) => (
          <div
            key={label}
            className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-2"
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-xl`}>
              {icon}
            </div>
            <div>
              <div className={`text-2xl font-black ${color}`}>
                {loading ? "—" : value.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Events by Type */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">
            Events by Type
          </h2>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-slate-800 rounded" />
              ))}
            </div>
          ) : stats?.events_by_type && Object.keys(stats.events_by_type).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.events_by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(stats.events_by_type));
                  const pct = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1">
                          {EVENT_ICONS[type] ?? EVENT_ICONS.DEFAULT} {type}
                        </span>
                        <span className="font-bold text-slate-300">{count}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-4">No events in the last 24h ✓</p>
          )}
        </div>

        {/* Top IPs */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">
            Top Source IPs
          </h2>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-800 rounded" />
              ))}
            </div>
          ) : stats?.top_ips && stats.top_ips.length > 0 ? (
            <div className="space-y-2">
              {stats.top_ips.slice(0, 8).map(({ ip, count }, idx) => (
                <div
                  key={ip}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-4 text-right">{idx + 1}</span>
                    <code className="text-sm text-slate-300 font-mono">{ip}</code>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{count} events</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-4">No suspicious IPs detected ✓</p>
          )}
        </div>
      </div>

      {/* Recent Events Log */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
        <h2 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">
          Recent Security Events
        </h2>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded-xl" />
            ))}
          </div>
        ) : stats?.recent_events && stats.recent_events.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {stats.recent_events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors group"
              >
                <span className="text-lg mt-0.5 flex-shrink-0">
                  {EVENT_ICONS[event.event_type] ?? EVENT_ICONS.DEFAULT}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-200">{event.event_type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SEVERITY_COLORS[event.severity] ?? SEVERITY_COLORS.INFO}`}>
                      {event.severity}
                    </span>
                    {event.endpoint && (
                      <code className="text-[10px] text-slate-500 font-mono">{event.endpoint}</code>
                    )}
                  </div>
                  {event.details && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{event.details}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {event.ip_address && (
                    <code className="text-[10px] text-slate-500 font-mono block">{event.ip_address}</code>
                  )}
                  <span className="text-[10px] text-slate-600">
                    {new Date(event.created_at).toLocaleTimeString("vi-VN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-400 font-semibold">No security events in the last 24 hours</p>
            <p className="text-slate-600 text-sm mt-1">System operating normally</p>
          </div>
        )}
      </div>

      {/* Grafana embed hint */}
      <div className="mt-6 p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center gap-3">
        <span className="text-2xl">📊</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-indigo-300">Full Metrics Dashboard (Grafana)</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Prometheus collects 20+ metrics every 10s. View inference latency, queue depth, error rates, and prediction distributions in Grafana.
          </p>
        </div>
        <a
          href="http://localhost:3000/d/ai-detector-main"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
