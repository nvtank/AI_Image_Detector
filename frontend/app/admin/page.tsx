"use client";

/**
 * Admin Dashboard Overview
 * ========================
 * Shows high-level stats: users, revenue, orders, predictions.
 * Links to sub-pages: Users, Orders, Security.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type AdminStats = {
  total_users: number;
  users_by_role: Record<string, number>;
  users_by_tier: Record<string, number>;
  new_users_month: number;
  total_predictions: number;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  revenue_month: number;
};

const PLAN_LABELS: Record<string, string> = {
  plus: "Plus",
  pro: "Pro",
  free: "Free",
};

const TIER_COLORS: Record<string, string> = {
  free: "#6b7280",
  plus: "#7c3aed",
  pro: "#d97706",
};

function fmtVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "var(--ink)",
  bg = "var(--canvas-soft)",
  href,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  bg?: string;
  href?: string;
}) {
  const content = (
    <div
      className="card"
      style={{
        padding: "1.5rem",
        borderRadius: "var(--r-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        cursor: href ? "pointer" : "default",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (href) {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--r-md)",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.375rem",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "2rem", fontWeight: 900, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--mute)", marginTop: 4 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "0.75rem", color: "var(--body)", marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {href && (
        <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>
          Xem chi tiết →
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: "none" }}>{content}</Link>;
  }
  return content;
}

function AdminNavCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{
          padding: "1.5rem",
          borderRadius: "var(--r-xl)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          cursor: "pointer",
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "";
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--r-lg)",
            background: "var(--primary-pale)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "1rem" }}>{title}</span>
            {badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--body)", marginTop: 2 }}>{description}</div>
        </div>
        <span style={{ color: "var(--mute)", fontSize: "1.25rem" }}>›</span>
      </div>
    </Link>
  );
}

function AdminDashboardContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.96px", color: "var(--ink)", margin: 0 }}>
            👑 Admin Dashboard
          </h1>
          <p style={{ color: "var(--body)", marginTop: 4, fontSize: "0.9375rem", margin: 0 }}>
            Tổng quan hệ thống — quản lý người dùng, đơn hàng và bảo mật
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="btn-secondary"
          style={{ padding: "8px 16px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600 }}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "var(--negative-bg)", color: "#fff", borderRadius: "var(--r-xl)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          ⚠ {error}
        </div>
      )}

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        <StatCard
          icon="👥"
          label="Tổng người dùng"
          value={loading ? "—" : (stats?.total_users ?? 0).toLocaleString()}
          sub={loading ? "" : `+${stats?.new_users_month ?? 0} tháng này`}
          color="var(--ink)"
          bg="var(--canvas-soft)"
          href="/admin/users"
        />
        <StatCard
          icon="🧠"
          label="Lượt phân tích"
          value={loading ? "—" : (stats?.total_predictions ?? 0).toLocaleString()}
          color="var(--primary-neutral)"
          bg="var(--primary-pale)"
        />
        <StatCard
          icon="🛒"
          label="Đơn hàng đã thanh toán"
          value={loading ? "—" : `${stats?.paid_orders ?? 0} / ${stats?.total_orders ?? 0}`}
          sub="paid / total"
          color="#059669"
          bg="rgba(5, 150, 105, 0.08)"
          href="/admin/orders"
        />
        <StatCard
          icon="💰"
          label="Tổng doanh thu"
          value={loading ? "—" : fmtVND(stats?.total_revenue ?? 0)}
          sub={loading ? "" : `${fmtVND(stats?.revenue_month ?? 0)} tháng này`}
          color="#d97706"
          bg="rgba(217, 119, 6, 0.1)"
          href="/admin/orders"
        />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Users by tier */}
        <div className="card" style={{ padding: "1.5rem", borderRadius: "var(--r-xl)" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Người dùng theo gói
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: 32, borderRadius: "var(--r-sm)", background: "var(--canvas-soft)", animation: "pulse 1.5s ease infinite" }} />
              ))}
            </div>
          ) : stats?.users_by_tier ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {Object.entries(stats.users_by_tier)
                .sort(([, a], [, b]) => b - a)
                .map(([tier, count]) => {
                  const total = stats.total_users || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={tier}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.8125rem" }}>
                        <span style={{ color: "var(--body)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_COLORS[tier] || "var(--mute)", display: "inline-block" }} />
                          {PLAN_LABELS[tier] || tier}
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{count} <span style={{ color: "var(--mute)", fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ width: "100%", background: "var(--canvas-soft)", borderRadius: "var(--r-pill)", height: 6 }}>
                        <div style={{ height: 6, borderRadius: "var(--r-pill)", background: TIER_COLORS[tier] || "var(--primary)", width: `${pct}%`, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p style={{ color: "var(--mute)", fontSize: "0.875rem", textAlign: "center", margin: 0 }}>No data</p>
          )}
        </div>

        {/* Users by role */}
        <div className="card" style={{ padding: "1.5rem", borderRadius: "var(--r-xl)" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Phân quyền
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(2)].map((_, i) => (
                <div key={i} style={{ height: 64, borderRadius: "var(--r-lg)", background: "var(--canvas-soft)", animation: "pulse 1.5s ease infinite" }} />
              ))}
            </div>
          ) : stats?.users_by_role ? (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {[
                { key: "user", icon: "👤", label: "User", color: "var(--primary)" },
                { key: "admin", icon: "👑", label: "Admin", color: "#d97706" },
              ].map(({ key, icon, label, color }) => (
                <div
                  key={key}
                  className="card-inner"
                  style={{ flex: 1, minWidth: 130, padding: "1rem", borderRadius: "var(--r-lg)", textAlign: "center" }}
                >
                  <div style={{ fontSize: "1.75rem", marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color, letterSpacing: "-0.03em" }}>
                    {stats.users_by_role[key] ?? 0}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--mute)", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Quick nav */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--mute)", margin: 0, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Công cụ quản lý
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        <AdminNavCard
          href="/admin/users"
          icon="👥"
          title="Quản lý người dùng"
          description="Xem, tìm kiếm, phân quyền và xóa tài khoản người dùng"
          badge={loading ? undefined : String(stats?.total_users ?? "")}
        />
        <AdminNavCard
          href="/admin/orders"
          icon="🛒"
          title="Quản lý đơn hàng"
          description="Xem toàn bộ lịch sử giao dịch và trạng thái thanh toán"
          badge={loading ? undefined : String(stats?.total_orders ?? "")}
        />
        <AdminNavCard
          href="/admin/security"
          icon="🔒"
          title="Giám sát bảo mật"
          description="Audit log, IP đáng ngờ và sự kiện bảo mật theo thời gian thực"
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requireRole="admin">
      <AdminDashboardContent />
    </AuthGuard>
  );
}
