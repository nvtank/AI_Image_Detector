"use client";

/**
 * Admin: User Management Page
 * ============================
 * Features:
 *  - Search users by name/email
 *  - Filter by role and subscription tier
 *  - Promote/demote role (user ↔ admin)
 *  - Change subscription tier (free/plus/pro)
 *  - Delete user account
 *  - Pagination
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  tokens: number;
  subscription_tier: "free" | "plus" | "pro";
  subscription_expires_at: string | null;
  created_at: string;
};

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  free:  { label: "Free",  color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  plus:  { label: "Plus",  color: "#7c3aed", bg: "rgba(124,58,237,0.1)"  },
  pro:   { label: "Pro",   color: "#d97706", bg: "rgba(217,119,6,0.1)"   },
};

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  user:  { label: "User",  color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
  admin: { label: "Admin", color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
};

function Badge({ type, value }: { type: "tier" | "role"; value: string }) {
  const map = type === "tier" ? TIER_BADGE : ROLE_BADGE;
  const b = map[value] ?? { label: value, color: "var(--mute)", bg: "var(--canvas-soft)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: "var(--r-pill)", color: b.color, background: b.bg }}>
      {b.label}
    </span>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "2rem", borderRadius: "var(--r-2xl)" }}>
        <h3 style={{ margin: 0, marginBottom: "0.5rem", color: "var(--ink)", fontSize: "1.125rem", fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: 0, marginBottom: "1.5rem", color: "var(--body)", fontSize: "0.9rem" }}>{description}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} className="btn-secondary" style={{ padding: "8px 16px", borderRadius: "var(--r-md)", fontSize: 13 }}>
            Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--r-md)",
              fontSize: 13,
              fontWeight: 700,
              background: danger ? "var(--negative)" : "var(--primary)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  currentAdminId,
  onRoleChange,
  onTierChange,
  onDelete,
}: {
  user: User;
  currentAdminId?: number;
  onRoleChange: (id: number, role: "user" | "admin") => Promise<void>;
  onTierChange: (id: number, tier: "free" | "plus" | "pro") => Promise<void>;
  onDelete: (id: number, name: string) => void;
}) {
  const isSelf = user.id === currentAdminId;
  const [loading, setLoading] = useState(false);

  const handleRoleToggle = async () => {
    if (isSelf || loading) return;
    setLoading(true);
    try {
      await onRoleChange(user.id, user.role === "admin" ? "user" : "admin");
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (loading) return;
    setLoading(true);
    try {
      await onTierChange(user.id, e.target.value as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr style={{ borderBottom: "1px solid var(--canvas-soft)" }}>
      <td style={{ padding: "0.875rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--primary-pale)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 700, color: "var(--primary-neutral)", flexShrink: 0,
          }}>
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.875rem" }}>
              {user.full_name}
              {isSelf && <span style={{ fontSize: 10, color: "var(--primary)", marginLeft: 6, fontWeight: 700 }}>YOU</span>}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--mute)" }}>{user.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <Badge type="role" value={user.role} />
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <select
          value={user.subscription_tier}
          onChange={handleTierChange}
          disabled={loading}
          style={{
            padding: "4px 8px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--canvas-soft)",
            background: "var(--canvas)",
            color: "var(--ink)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="free">Free</option>
          <option value="plus">Plus</option>
          <option value="pro">Pro</option>
        </select>
      </td>
      <td style={{ padding: "0.875rem 1rem", textAlign: "center" }}>
        <span style={{ fontWeight: 700, color: user.tokens > 0 ? "var(--ink)" : "var(--negative)", fontSize: "0.875rem" }}>
          {user.tokens.toLocaleString()}
        </span>
      </td>
      <td style={{ padding: "0.875rem 1rem", fontSize: "0.75rem", color: "var(--mute)" }}>
        {new Date(user.created_at).toLocaleDateString("vi-VN")}
      </td>
      <td style={{ padding: "0.875rem 1rem" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={handleRoleToggle}
            disabled={isSelf || loading}
            title={isSelf ? "Không thể thay đổi quyền của chính mình" : user.role === "admin" ? "Hạ xuống User" : "Nâng lên Admin"}
            style={{
              padding: "5px 10px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--canvas-soft)",
              background: user.role === "admin" ? "rgba(220,38,38,0.08)" : "rgba(37,99,235,0.08)",
              color: user.role === "admin" ? "#dc2626" : "#2563eb",
              fontSize: 11,
              fontWeight: 700,
              cursor: isSelf ? "not-allowed" : "pointer",
              opacity: isSelf || loading ? 0.4 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {user.role === "admin" ? "↓ User" : "↑ Admin"}
          </button>
          <button
            onClick={() => !isSelf && onDelete(user.id, user.full_name)}
            disabled={isSelf || loading}
            title={isSelf ? "Không thể xóa tài khoản của mình" : "Xóa người dùng"}
            style={{
              padding: "5px 8px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--canvas-soft)",
              background: "rgba(220,38,38,0.06)",
              color: "#dc2626",
              fontSize: 13,
              cursor: isSelf ? "not-allowed" : "pointer",
              opacity: isSelf || loading ? 0.4 : 1,
            }}
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers({
        limit,
        offset,
        search: search || undefined,
        role: roleFilter || undefined,
        tier: tierFilter || undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [offset, search, roleFilter, tierFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = (val: string) => {
    setSearch(val);
    setOffset(0);
    clearTimeout(searchTimeout.current);
  };

  const handleRoleChange = async (id: number, role: "user" | "admin") => {
    try {
      await api.updateUserRole(id, role);
      showToast(`Đã cập nhật role thành ${role}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to update role", false);
    }
  };

  const handleTierChange = async (id: number, tier: "free" | "plus" | "pro") => {
    try {
      await api.updateUserTier(id, tier);
      showToast(`Đã cập nhật gói thành ${tier}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to update tier", false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteUser(confirmDelete.id);
      showToast(`Đã xóa user ${confirmDelete.name}`);
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to delete user", false);
      setConfirmDelete(null);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 2000,
          padding: "12px 20px", borderRadius: "var(--r-xl)",
          background: toast.ok ? "#059669" : "#dc2626",
          color: "#fff", fontWeight: 600, fontSize: "0.875rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "fade-up 0.2s ease",
        }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Xóa người dùng"
        description={`Bạn có chắc muốn xóa tài khoản "${confirmDelete?.name}"? Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <a href="/admin" style={{ color: "var(--mute)", fontSize: "0.8125rem", textDecoration: "none" }}>← Admin</a>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: "0.25rem 0 0" }}>
            👥 Quản lý người dùng
          </h1>
          <p style={{ color: "var(--body)", margin: 0, fontSize: "0.875rem" }}>
            {total.toLocaleString()} tài khoản
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "1rem 1.25rem", borderRadius: "var(--r-xl)", marginBottom: "1.25rem", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="🔍  Tìm theo tên hoặc email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200,
            padding: "8px 12px", borderRadius: "var(--r-md)",
            border: "1px solid var(--canvas-soft)",
            background: "var(--canvas)", color: "var(--ink)", fontSize: "0.875rem",
          }}
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setOffset(0); }} style={{ padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--canvas-soft)", background: "var(--canvas)", color: "var(--ink)", fontSize: "0.875rem" }}>
          <option value="">Tất cả role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setOffset(0); }} style={{ padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--canvas-soft)", background: "var(--canvas)", color: "var(--ink)", fontSize: "0.875rem" }}>
          <option value="">Tất cả gói</option>
          <option value="free">Free</option>
          <option value="plus">Plus</option>
          <option value="pro">Pro</option>
        </select>
        <button onClick={fetchUsers} className="btn-secondary" style={{ padding: "8px 14px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600 }}>
          ↻
        </button>
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
                {["Người dùng", "Role", "Gói", "Tokens", "Ngày tạo", "Hành động"].map((col) => (
                  <th key={col} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--canvas-soft)" }}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} style={{ padding: "0.875rem 1rem" }}>
                        <div style={{ height: 20, background: "var(--canvas-soft)", borderRadius: "var(--r-sm)", animation: "pulse 1.5s ease infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--mute)" }}>
                    Không tìm thấy người dùng nào
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onRoleChange={handleRoleChange}
                    onTierChange={handleTierChange}
                    onDelete={(id, name) => setConfirmDelete({ id, name })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--canvas-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--mute)" }}>
              Trang {currentPage} / {totalPages} — {total} người dùng
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

export default function AdminUsersPage() {
  return (
    <AuthGuard requireRole="admin">
      <UsersContent />
    </AuthGuard>
  );
}
