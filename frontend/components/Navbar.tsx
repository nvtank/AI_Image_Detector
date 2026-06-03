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
  const { user, isAuthenticated, isAdmin, logout, logoutAll, loading } =
    useAuth();
  const { t, locale, toggleLocale } = useLanguage();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };
  const handleLogoutAll = async () => {
    if (confirm(t("nav.logoutAllConfirm"))) {
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
    <nav className="nav-bar">
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 48,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-sm)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--r-sm)",
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--on-primary)",
              fontSize: "0.6875rem",
              fontWeight: 900,
            }}
          >
            AI
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.02em",
            }}
          >
            Detector
          </span>
        </Link>

        {/* Nav links + Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!loading &&
            links.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${pathname === href ? "nav-link-active" : ""}`}
              >
                {t(`nav.${key}`)}
              </Link>
            ))}

          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            title={
              locale === "vi"
                ? "Switch to English"
                : "Chuyển sang Tiếng Việt"
            }
            style={{
              padding: "4px 10px",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: "var(--canvas-soft)",
              color: "var(--ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginLeft: 4,
            }}
          >
            {locale === "vi" ? "🇬🇧 EN" : "🇻🇳 VI"}
          </button>

          {/* Auth section */}
          {!loading && (
            <div
              style={{
                borderLeft: "1px solid var(--canvas-soft)",
                marginLeft: "var(--sp-sm)",
                paddingLeft: "var(--sp-md)",
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-sm)",
              }}
            >
              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div
                    className="hidden sm:flex"
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--body)",
                        fontSize: 13,
                        maxWidth: 130,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.2,
                      }}
                    >
                      {user?.full_name || user?.email}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isAdmin ? "var(--ink-deep)" : "var(--mute)",
                        background: isAdmin
                          ? "var(--primary-pale)"
                          : "var(--canvas-soft)",
                        padding: "0 6px",
                        borderRadius: 4,
                      }}
                    >
                      {isAdmin ? t("nav.admin") : t("nav.user")}
                    </span>
                  </div>

                  <NotificationBell />

                  {/* Logout */}
                  <div className="relative group">
                    <button
                      onClick={handleLogout}
                      className="nav-link"
                      style={{ color: "var(--body)" }}
                    >
                      {t("nav.logout")}
                    </button>
                    <button
                      onClick={handleLogoutAll}
                      title={t("nav.logoutAll")}
                      style={{
                        fontSize: 12,
                        color: "var(--body)",
                        background: "var(--canvas)",
                        border: "1px solid var(--canvas-soft)",
                        borderRadius: "var(--r-sm)",
                        padding: "8px 12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        whiteSpace: "nowrap",
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: 4,
                        display: "none",
                      }}
                      className="group-hover:!block"
                    >
                      {t("nav.logoutAll")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="nav-link"
                    style={{ color: "var(--body)" }}
                  >
                    {t("nav.login")}
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    {t("nav.signup")}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
