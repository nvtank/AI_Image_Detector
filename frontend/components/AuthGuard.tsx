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
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-slate-400 text-sm">Đang kiểm tra phiên đăng nhập...</p>
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
        <div className="text-center max-w-md px-6">
          {/* Shield icon */}
          <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-400"
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
          <h1 className="text-2xl font-bold text-white mb-2">403 — Không có quyền truy cập</h1>
          <p className="text-slate-400 mb-1">
            Trang này chỉ dành cho <span className="text-amber-400 font-semibold">Quản trị viên</span>.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Tài khoản của bạn có vai trò: <code className="bg-slate-800 px-1 rounded text-slate-300">{role}</code>
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
