"use client";

/**
 * NotificationBell — Real-Time Notification UI
 * =============================================
 * Bell icon in the Navbar with:
 *   - Unread badge count (animated pulse when > 0)
 *   - Dropdown notification list
 *   - WS connection status indicator (green dot = connected)
 *   - Per-notification read/dismiss
 *   - "Mark all read" + "Clear all" actions
 */

import { useState, useRef, useEffect } from "react";
import { useNotifications, AppNotification } from "@/context/NotificationContext";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  info:    { bg: "bg-blue-400/10",   border: "border-blue-400/30",   icon: "ℹ️" },
  success: { bg: "bg-green-400/10",  border: "border-green-400/30",  icon: "✅" },
  warning: { bg: "bg-amber-400/10",  border: "border-amber-400/30",  icon: "⚠️" },
  error:   { bg: "bg-red-400/10",    border: "border-red-400/30",    icon: "🚨" },
};

function NotificationItem({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
  return (
    <div
      className={`p-3 rounded-xl border transition-all cursor-pointer hover:opacity-90 ${style.bg} ${style.border} ${!n.read ? "ring-1 ring-inset ring-white/10" : "opacity-70"}`}
      onClick={() => onRead(n.id)}
    >
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0 mt-0.5">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 leading-tight">{n.title}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
          <p className="text-[10px] text-slate-600 mt-1">
            {n.timestamp.toLocaleTimeString("vi-VN")}
          </p>
        </div>
        {!n.read && (
          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { notifications, unreadCount, isConnected, markRead, markAllRead, clearAll } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label={`${unreadCount} unread notifications`}
        id="notification-bell-btn"
      >
        {/* Bell SVG */}
        <svg
          className={`w-5 h-5 transition-transform ${open ? "scale-110" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full bg-red-500 text-white flex items-center justify-center animate-bounce-subtle">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {/* WS connection indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
            isConnected ? "bg-green-400" : "bg-slate-600"
          }`}
          title={isConnected ? "Real-time connected" : "Disconnected — using polling"}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Thông báo</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                isConnected
                  ? "bg-green-400/15 text-green-400"
                  : "bg-slate-700 text-slate-400"
              }`}>
                {isConnected ? "⚡ Live" : "○ Offline"}
              </span>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Đọc tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <span className="text-3xl block mb-2">🔔</span>
                <p className="text-sm text-slate-500">Không có thông báo nào</p>
                {isConnected && (
                  <p className="text-xs text-slate-600 mt-1">Kết nối real-time đang hoạt động</p>
                )}
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
