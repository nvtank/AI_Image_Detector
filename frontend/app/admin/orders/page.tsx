"use client";

/**
 * Admin: Orders Management Page
 * ==============================
 * Features:
 *  - View all payment orders with user info
 *  - Filter by status (pending / paid / cancelled) and plan
 *  - Revenue summary
 *  - Pagination
 */

import React, { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type Order = {
  id: number;
  order_code: number;
  plan: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  checkout_url: string | null;
  created_at: string;
  paid_at: string | null;
  user_id: number;
  full_name: string;
  email: string;
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paid:      { label: "Đã thanh toán", color: "#059669", bg: "rgba(5,150,105,0.1)",   icon: "✓" },
  pending:   { label: "Chờ thanh toán", color: "#d97706", bg: "rgba(217,119,6,0.1)",  icon: "⏳" },
  cancelled: { label: "Đã hủy",        color: "#6b7280", bg: "rgba(107,114,128,0.1)", icon: "✗" },
};

const PLAN_LABELS: Record<string, string> = {
  plus:      "Plus (49k)",
  pro:       "Pro (149k)",
  tokens_20: "Tokens ×20 (25k)",
};

function fmtVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: "var(--mute)", bg: "var(--canvas-soft)", icon: "?" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--r-pill)", color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {s.icon} {s.label}
    </span>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--canvas-soft)" }}>
      <td style={{ padding: "0.875rem 1rem" }}>
        <code style={{ fontSize: "0.8125rem", color: "var(--primary-neutral)", fontFamily: "monospace" }}>
          #{order.order_code}
        </code>
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)" }}>
          {order.full_name || "—"}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--mute)" }}>{order.email || `user #${order.user_id}`}</div>
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--body)" }}>
          {PLAN_LABELS[order.plan] || order.plan}
        </span>
      </td>
      <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
        <span style={{ fontWeight: 700, color: order.status === "paid" ? "#059669" : "var(--ink)", fontSize: "0.875rem" }}>
          {fmtVND(order.amount)}
        </span>
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <StatusBadge status={order.status} />
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: "0.75rem", color: "var(--mute)" }}>
        <div>{new Date(order.created_at).toLocaleDateString("vi-VN")}</div>
        <div>{new Date(order.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: "0.75rem", color: "var(--mute)" }}>
        {order.paid_at ? (
          <>
            <div>{new Date(order.paid_at).toLocaleDateString("vi-VN")}</div>
            <div>{new Date(order.paid_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        {order.checkout_url && order.status === "pending" && (
          <a
            href={order.checkout_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
          >
            🔗 Link
          </a>
        )}
      </td>
    </tr>
  );
}

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminOrders({
        limit,
        offset,
        status: statusFilter || undefined,
        plan: planFilter || undefined,
      });
      setOrders(data.orders);
      setTotal(data.total);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [offset, statusFilter, planFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Summary stats from visible orders
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.amount, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <a href="/admin" style={{ color: "var(--mute)", fontSize: "0.8125rem", textDecoration: "none" }}>← Admin</a>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: "0.25rem 0 0" }}>
            🛒 Quản lý đơn hàng
          </h1>
          <p style={{ color: "var(--body)", margin: 0, fontSize: "0.875rem" }}>
            {total.toLocaleString()} giao dịch tổng cộng
          </p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary" style={{ padding: "8px 16px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { icon: "💰", label: "Doanh thu (trang này)", value: fmtVND(totalRevenue), color: "#059669", bg: "rgba(5,150,105,0.08)" },
          { icon: "✓",  label: "Đã thanh toán",         value: paidOrders.length, color: "#059669", bg: "rgba(5,150,105,0.08)" },
          { icon: "⏳", label: "Đang chờ",               value: pendingOrders, color: "#d97706", bg: "rgba(217,119,6,0.08)" },
          { icon: "✗",  label: "Đã hủy",                 value: cancelledOrders, color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} className="card" style={{ padding: "1.25rem", borderRadius: "var(--r-xl)", display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: "1.375rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--mute)", marginTop: 2, fontWeight: 600 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "1rem 1.25rem", borderRadius: "var(--r-xl)", marginBottom: "1.25rem", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          style={{ padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--canvas-soft)", background: "var(--canvas)", color: "var(--ink)", fontSize: "0.875rem" }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="paid">Đã thanh toán</option>
          <option value="pending">Đang chờ</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setOffset(0); }}
          style={{ padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--canvas-soft)", background: "var(--canvas)", color: "var(--ink)", fontSize: "0.875rem" }}
        >
          <option value="">Tất cả gói</option>
          <option value="plus">Plus</option>
          <option value="pro">Pro</option>
          <option value="tokens_20">Tokens ×20</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "var(--negative-bg)", color: "#fff", borderRadius: "var(--r-xl)", marginBottom: "1.25rem", fontSize: "0.875rem" }}>
          ⚠ {error}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ borderRadius: "var(--r-xl)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--canvas-soft)" }}>
                {["Mã đơn", "Người dùng", "Gói", "Số tiền", "Trạng thái", "Tạo lúc", "Thanh toán lúc", ""].map((col) => (
                  <th key={col} style={{ padding: "0.75rem 1rem", textAlign: col === "Số tiền" ? "right" : "left", fontSize: 11, fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--canvas-soft)" }}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} style={{ padding: "0.875rem 1rem" }}>
                        <div style={{ height: 20, background: "var(--canvas-soft)", borderRadius: "var(--r-sm)", animation: "pulse 1.5s ease infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--mute)" }}>
                    Không tìm thấy đơn hàng nào
                  </td>
                </tr>
              ) : (
                orders.map((order) => <OrderRow key={order.id} order={order} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--canvas-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--mute)" }}>
              Trang {currentPage} / {totalPages} — {total} đơn hàng
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="btn-secondary"
                style={{ padding: "6px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600, opacity: offset === 0 ? 0.4 : 1 }}
              >
                ← Trước
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="btn-secondary"
                style={{ padding: "6px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600, opacity: offset + limit >= total ? 0.4 : 1 }}
              >
                Tiếp →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <AuthGuard requireRole="admin">
      <OrdersContent />
    </AuthGuard>
  );
}
