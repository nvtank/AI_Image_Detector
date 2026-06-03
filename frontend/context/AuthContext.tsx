"use client";

/**
 * AuthContext — Dual-Token Session Manager + RBAC
 * ================================================
 * Session lifecycle:
 *   1. On mount: check sessionStorage for refresh_token + cached user.
 *      If found, silently call /auth/refresh to re-hydrate in-memory access token.
 *   2. Auto-refresh timer: proactively refreshes access token every 14 minutes
 *      (before the 15-min TTL expires), so users never experience a 401 mid-session.
 *   3. Logout: revokes refresh token on server, clears all local state.
 *   4. Role: exposed via context so UI can show/hide admin features.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  api,
  setAccessToken,
  setRefreshToken,
  setCachedUser,
  getRefreshToken,
  getCachedUser,
  clearAccessToken,
  clearRefreshToken,
  clearCachedUser,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type Role = "user" | "admin";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithGithub: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
};

// ── Context ────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

// ── Auto-refresh interval: every 14 min (access token TTL = 15 min) ────────
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Session store helper ───────────────────────────────────────────────
  const persistSession = useCallback(
    (userData: User, accessToken: string, refreshToken: string, expiresIn = 900) => {
      setUser(userData);
      setAccessToken(accessToken, expiresIn);
      setRefreshToken(refreshToken);
      setCachedUser(userData);
    },
    []
  );

  const clearSession = useCallback(() => {
    setUser(null);
    clearAccessToken();
    clearRefreshToken();
    clearCachedUser();
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ── Proactive token refresh ────────────────────────────────────────────
  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    refreshTimerRef.current = setInterval(async () => {
      const rt = getRefreshToken();
      if (!rt) {
        clearSession();
        return;
      }
      try {
        const data = await api.refresh(rt);
        persistSession(
          { ...data.user, role: data.user.role ?? "user" },
          data.access_token,
          data.refresh_token,
          data.expires_in ?? 900
        );
      } catch {
        clearSession();
      }
    }, REFRESH_INTERVAL_MS);
  }, [clearSession, persistSession]);

  // ── Restore session on page load ───────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedRt = getRefreshToken();
        const cachedUser = getCachedUser();

        if (!storedRt) {
          setLoading(false);
          return;
        }

        // Optimistically restore cached user so UI renders immediately
        if (cachedUser) {
          setUser({ ...cachedUser, role: cachedUser.role ?? "user" });
        }

        // Silently refresh to get a valid in-memory access token
        const data = await api.refresh(storedRt);
        persistSession(
          { ...data.user, role: data.user.role ?? "user" },
          data.access_token,
          data.refresh_token,
          data.expires_in ?? 900
        );
        startRefreshTimer();
      } catch {
        // Refresh token expired or invalid — clear everything
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.login(email, password);
      persistSession(
        { ...data.user, role: data.user.role ?? "user" },
        data.access_token,
        data.refresh_token,
        data.expires_in ?? 900
      );
      startRefreshTimer();
    },
    [persistSession, startRefreshTimer]
  );

  const signup = useCallback(
    async (fullName: string, email: string, password: string) => {
      const data = await api.signup(fullName, email, password);
      persistSession(
        { ...data.user, role: data.user.role ?? "user" },
        data.access_token,
        data.refresh_token,
        data.expires_in ?? 900
      );
      startRefreshTimer();
    },
    [persistSession, startRefreshTimer]
  );

  const loginWithGithub = useCallback(
    async (code: string) => {
      const data = await api.loginWithGithub(code);
      persistSession(
        { ...data.user, role: data.user.role ?? "user" },
        data.access_token,
        data.refresh_token,
        data.expires_in ?? 900
      );
      startRefreshTimer();
    },
    [persistSession, startRefreshTimer]
  );

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try {
      if (rt) await api.logout(rt);
    } catch {
      // Server-side revocation failure is non-fatal — always clear local state
    }
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll();
    } catch {
      // Non-fatal
    }
    clearSession();
  }, [clearSession]);

  // ── Derived state ─────────────────────────────────────────────────────
  const role = user?.role ?? null;
  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isAdmin,
        loading,
        login,
        signup,
        loginWithGithub,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
