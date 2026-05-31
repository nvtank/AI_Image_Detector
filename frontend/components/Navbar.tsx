"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import NotificationBell from "@/components/NotificationBell";

const publicLinks = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/about", key: "about" },
];
const userLinks = [
  { href: "/upload", key: "upload" },
  { href: "/history", key: "history" },
  { href: "/dashboard", key: "dashboard" },
  { href: "/about", key: "about" },
];
const adminLinks = [
  { href: "/upload", key: "upload" },
  { href: "/history", key: "history" },
  { href: "/dashboard", key: "dashboard" },
  { href: "/admin/security", key: "security" },
  { href: "/about", key: "about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, logout, logoutAll, loading } = useAuth();
  const { t, locale, toggleLocale } = useLanguage();
  const router = useRouter();

  const handleLogout = async () => { await logout(); router.push("/"); };
  const handleLogoutAll = async () => {
    if (confirm(t("nav.logoutAllConfirm"))) { await logoutAll(); router.push("/"); }
  };

  const links = isAuthenticated ? (isAdmin ? adminLinks : userLinks) : publicLinks;

  return (
    <nav
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">

          {/* Logo */}
          <Link
            href="/"
            className="text-base flex items-center gap-2"
            style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "0.75rem", fontWeight: 800,
            }}>
              AI
            </span>
            <span className="gradient-text font-bold">Detector</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {!loading && links.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                style={{
                  color: pathname === href ? "var(--accent)" : "var(--text-3)",
                  fontWeight: pathname === href ? 600 : 400,
                  fontSize: "0.875rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "8px",
                  background: pathname === href ? "var(--accent-light)" : "transparent",
                }}
                className="hover:bg-[var(--bg-2)] transition-colors"
              >
                {t(`nav.${key}`)}
              </Link>
            ))}

            {/* Language toggle */}
            <button
              onClick={toggleLocale}
              title={locale === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 600,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-2)",
                cursor: "pointer",
                marginLeft: "0.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
              className="hover:bg-[var(--bg-2)] transition-colors"
            >
              {locale === "vi" ? "🇬🇧 EN" : "🇻🇳 VI"}
            </button>

            {/* Auth section */}
            {!loading && (
              <div
                style={{ borderLeft: "1px solid var(--border)", marginLeft: "0.5rem", paddingLeft: "0.75rem" }}
                className="flex items-center gap-2"
              >
                {isAuthenticated ? (
                  <>
                    {/* User info */}
                    <div className="hidden sm:flex flex-col items-end">
                      <span style={{ color: "var(--text-2)", fontSize: "0.8125rem", maxWidth: 130 }} className="truncate leading-tight">
                        {user?.full_name || user?.email}
                      </span>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 600,
                        color: isAdmin ? "var(--accent)" : "var(--text-4)",
                        background: isAdmin ? "var(--accent-light)" : "var(--bg-3)",
                        padding: "0 6px",
                        borderRadius: 4,
                      }}>
                        {isAdmin ? t("nav.admin") : t("nav.user")}
                      </span>
                    </div>

                    <NotificationBell />

                    {/* Logout */}
                    <div className="relative group">
                      <button
                        onClick={handleLogout}
                        style={{ color: "var(--text-3)", fontSize: "0.875rem", padding: "0.35rem 0.6rem", borderRadius: 8 }}
                        className="hover:bg-[var(--bg-2)] transition-colors"
                      >
                        {t("nav.logout")}
                      </button>
                      <button
                        onClick={handleLogoutAll}
                        title={t("nav.logoutAll")}
                        style={{
                          fontSize: "0.75rem", color: "var(--text-3)",
                          background: "var(--bg)", border: "1px solid var(--border)",
                          borderRadius: 8, padding: "0.5rem 0.75rem",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          whiteSpace: "nowrap",
                        }}
                        className="hidden group-hover:block absolute right-0 top-full mt-1"
                      >
                        {t("nav.logoutAll")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      style={{ color: "var(--text-3)", fontSize: "0.875rem", padding: "0.35rem 0.75rem", borderRadius: 8 }}
                      className="hover:bg-[var(--bg-2)] transition-colors"
                    >
                      {t("nav.login")}
                    </Link>
                    <Link
                      href="/signup"
                      className="btn-primary"
                    >
                      {t("nav.signup")}
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
