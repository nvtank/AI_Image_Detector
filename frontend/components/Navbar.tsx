"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

const publicLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About" },
];

const userLinks = [
  { href: "/upload", label: "Upload" },
  { href: "/history", label: "History" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About" },
];

// Admin-only links shown only when role === "admin"
const adminLinks = [
  { href: "/upload", label: "Upload" },
  { href: "/history", label: "History" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/security", label: "Security" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, role, logout, logoutAll, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleLogoutAll = async () => {
    if (confirm("Đăng xuất khỏi tất cả thiết bị?")) {
      await logoutAll();
      router.push("/");
    }
  };

  const links = isAuthenticated
    ? isAdmin
      ? adminLinks
      : userLinks
    : publicLinks;

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link
            href="/"
            className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400"
          >
            AI Detector
          </Link>

          <div className="flex items-center gap-1">
            {!loading &&
              links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {/* Highlight Security link for admin */}
                  {label === "Security" ? (
                    <span className="flex items-center gap-1">
                      <span>🔒</span> {label}
                    </span>
                  ) : (
                    label
                  )}
                </Link>
              ))}

            {!loading && (
              <div className="ml-3 flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                {isAuthenticated ? (
                  <>
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-sm text-slate-500 dark:text-slate-400 max-w-[140px] truncate leading-tight">
                        {user?.full_name || user?.email}
                      </span>
                      {/* RBAC Role badge */}
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                          isAdmin
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-slate-500/15 text-slate-400"
                        }`}
                      >
                        {isAdmin ? "⚡ Admin" : "User"}
                      </span>
                    </div>

                    {/* Phase 5: Real-Time Notification Bell */}
                    <NotificationBell />

                    {/* Logout dropdown */}
                    <div className="relative group">
                      <button
                        onClick={handleLogout}
                        className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Logout
                      </button>
                      {/* Logout all devices link */}
                      <button
                        onClick={handleLogoutAll}
                        title="Đăng xuất khỏi tất cả thiết bị"
                        className="hidden group-hover:block absolute right-0 top-full mt-1 w-48 px-3 py-2 text-xs text-red-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        🚪 Đăng xuất tất cả thiết bị
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 rounded-lg transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
