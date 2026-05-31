"use client";

import { useState, useRef, useEffect } from "react";
import { useNotifications, AppNotification } from "@/context/NotificationContext";

function NotificationItem({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  return (
    <div
      onClick={() => onRead(n.id)}
      style={{
        padding: "0.75rem 0.85rem",
        borderRadius: 10,
        cursor: "pointer",
        background: n.read ? "transparent" : "var(--bg-2)",
        border: "1px solid var(--border)",
        opacity: n.read ? 0.55 : 1,
        transition: "opacity 0.15s ease, background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{n.title}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {n.message}
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-4)", marginTop: 4 }}>
            {n.timestamp.toLocaleTimeString()}
          </p>
        </div>
        {!n.read && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-2)", flexShrink: 0, marginTop: 5 }} />
        )}
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { notifications, unreadCount, isConnected, markRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`${unreadCount} notifications`}
        style={{
          position: "relative",
          padding: "0.35rem",
          borderRadius: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Simple bell shape via border */}
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread count */}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 16, height: 16,
            fontSize: "0.625rem", fontWeight: 700,
            background: "var(--text-1)", color: "var(--accent-fg)",
            borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {/* WS status dot */}
        <span style={{
          position: "absolute", bottom: 0, right: 0,
          width: 7, height: 7, borderRadius: "50%",
          background: isConnected ? "#6b7280" : "var(--border-2)",
          border: "1.5px solid var(--bg)",
        }} title={isConnected ? "WebSocket connected" : "Polling fallback"} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="card fade-up"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 300, zIndex: 50, overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          {/* Header */}
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-1)" }}>Notifications</span>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                background: "var(--bg-3)", color: isConnected ? "var(--text-2)" : "var(--text-4)",
              }}>
                {isConnected ? "Live" : "Polling"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ fontSize: "0.75rem", color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} style={{ fontSize: "0.75rem", color: "var(--text-4)", background: "none", border: "none", cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "0.65rem", display: "flex", flexDirection: "column", gap: 6 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "2.5rem 0", textAlign: "center", color: "var(--text-4)", fontSize: "0.875rem" }}>
                No notifications
              </div>
            ) : (
              notifications.map(n => <NotificationItem key={n.id} n={n} onRead={markRead} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
