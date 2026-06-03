"use client";

/**
 * AuthGuard — RBAC-aware Route Protection Component
 * ==================================================
 * Usage:
 *   // Any authenticated user
 *   <AuthGuard><PageContent /></AuthGuard>
 *
 *   // Admin only — shows 403 forbidden page for non-admins
 *   <AuthGuard requireRole="admin"><AdminDashboard /></AuthGuard>
 *
 *   // Custom redirect target
 *   <AuthGuard redirectTo="/login?from=/dashboard"><PageContent /></AuthGuard>
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type AuthGuardProps = {
  children: React.ReactNode;
  /** If set, only users with this role can access the page. */
  requireRole?: "user" | "admin";
  /** Where to redirect unauthenticated users. Defaults to /login. */
  redirectTo?: string;
};

export default function AuthGuard({
  children,
  requireRole,
  redirectTo = "/login",
}: AuthGuardProps) {
  const { isAuthenticated, isAdmin, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, loading, router, redirectTo]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div
          className="card"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-md)',
            padding: 'var(--sp-2xl)', borderRadius: 'var(--r-xl)',
          }}
        >
          <div className="spinner" style={{ width: 32, height: 32, borderColor: 'var(--canvas-soft)', borderTopColor: 'var(--primary)' }} />
          <p style={{ color: 'var(--mute)', fontSize: 14, margin: 0 }}>Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!isAuthenticated) return null;

  // ── Admin-required page but user is not admin ────────────────────────────
  if (requireRole === "admin" && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="card"
          style={{
            textAlign: 'center', maxWidth: 420, padding: 'var(--sp-3xl) var(--sp-2xl)',
            borderRadius: 'var(--r-xl)', background: 'var(--canvas)',
          }}
        >
          {/* Shield icon */}
          <div style={{
            margin: '0 auto var(--sp-xl)',
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--negative-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg
              style={{ width: 40, height: 40, color: 'var(--negative)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--sp-sm)' }}>
            403 — Không có quyền truy cập
          </h1>
          <p style={{ color: 'var(--body)', marginBottom: 'var(--sp-xs)' }}>
            Trang này chỉ dành cho <span style={{ color: 'var(--warning-content)', fontWeight: 600 }}>Quản trị viên</span>.
          </p>
          <p style={{ color: 'var(--mute)', fontSize: 14, marginBottom: 'var(--sp-xl)' }}>
            Tài khoản của bạn có vai trò:{' '}
            <code style={{ background: 'var(--canvas-soft)', padding: '2px 6px', borderRadius: 'var(--r-sm)', color: 'var(--ink)', fontSize: 13 }}>
              {role}
            </code>
          </p>
          <button
            onClick={() => router.back()}
            className="btn-secondary"
            style={{ borderRadius: 'var(--r-xl)', fontSize: 14 }}
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
