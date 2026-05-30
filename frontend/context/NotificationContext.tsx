"use client";

/**
 * NotificationContext — Global Real-Time Notification State
 * ==========================================================
 * Phase 5: Manages the WebSocket connection and dispatches
 * typed events to registered listeners across the app.
 *
 * What it manages:
 *   - WebSocket connection lifecycle (via useWebSocket hook)
 *   - Notification queue (unread badge count)
 *   - Task progress updates (forwarded to upload page)
 *   - Security alert toasts for admin users
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useWebSocket, WSMessage } from "@/hooks/useWebSocket";
import { useAuth } from "@/context/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────
export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

type TaskProgressListener = (taskId: string, stage: string, label: string, percent: number) => void;
type TaskCompleteListener = (taskId: string, result: any) => void;
type TaskFailedListener = (taskId: string, error: string) => void;

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isConnected: boolean;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  subscribeToTask: (taskId: string) => void;
  onTaskProgress: (cb: TaskProgressListener) => () => void;
  onTaskComplete: (cb: TaskCompleteListener) => () => void;
  onTaskFailed: (cb: TaskFailedListener) => () => void;
}

// ── Context ────────────────────────────────────────────────────────────────
const NotificationContext = createContext<NotificationContextType | null>(null);

const SEVERITY_MAP: Record<string, NotificationSeverity> = {
  INFO: "info",
  WARNING: "warning",
  HIGH: "error",
  CRITICAL: "error",
};

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Listeners for task events (used by upload page)
  const taskProgressListeners = useRef<TaskProgressListener[]>([]);
  const taskCompleteListeners = useRef<TaskCompleteListener[]>([]);
  const taskFailedListeners = useRef<TaskFailedListener[]>([]);

  const addNotification = useCallback(
    (type: string, title: string, message: string, severity: NotificationSeverity, data?: Record<string, any>) => {
      const notification: AppNotification = {
        id: generateId(),
        type,
        title,
        message,
        severity,
        timestamp: new Date(),
        read: false,
        data,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep max 50
    },
    []
  );

  // ── WebSocket message dispatcher ────────────────────────────────────────
  const handleMessage = useCallback(
    (msg: WSMessage) => {
      const { type, data } = msg;

      switch (type) {
        case "task_progress":
          taskProgressListeners.current.forEach((cb) =>
            cb(data.task_id, data.stage, data.label, data.percent)
          );
          break;

        case "task_complete":
          taskCompleteListeners.current.forEach((cb) =>
            cb(data.task_id, data.result)
          );
          addNotification(
            "task_complete",
            "Phân tích hoàn thành ✅",
            `Kết quả: ${data.result?.final_decision ?? "Xem chi tiết"}`,
            "success",
            data
          );
          break;

        case "task_failed":
          taskFailedListeners.current.forEach((cb) =>
            cb(data.task_id, data.error)
          );
          addNotification(
            "task_failed",
            "Phân tích thất bại ❌",
            data.error || "Đã xảy ra lỗi khi xử lý ảnh",
            "error",
            data
          );
          break;

        case "security_alert":
          addNotification(
            "security_alert",
            `🚨 Security Alert: ${data.event_type}`,
            data.details || `Severity: ${data.severity}`,
            SEVERITY_MAP[data.severity] ?? "warning",
            data
          );
          break;

        case "connected":
        case "pong":
          // Heartbeat/connection confirmations — no notification needed
          break;

        default:
          break;
      }
    },
    [addNotification]
  );

  const { isConnected, sendMessage } = useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated,
  });

  // ── Public API ─────────────────────────────────────────────────────────
  const subscribeToTask = useCallback(
    (taskId: string) => {
      sendMessage("subscribe_task", { task_id: taskId });
    },
    [sendMessage]
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Listener registration
  const onTaskProgress = useCallback((cb: TaskProgressListener) => {
    taskProgressListeners.current.push(cb);
    return () => {
      taskProgressListeners.current = taskProgressListeners.current.filter((f) => f !== cb);
    };
  }, []);

  const onTaskComplete = useCallback((cb: TaskCompleteListener) => {
    taskCompleteListeners.current.push(cb);
    return () => {
      taskCompleteListeners.current = taskCompleteListeners.current.filter((f) => f !== cb);
    };
  }, []);

  const onTaskFailed = useCallback((cb: TaskFailedListener) => {
    taskFailedListeners.current.push(cb);
    return () => {
      taskFailedListeners.current = taskFailedListeners.current.filter((f) => f !== cb);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        markAllRead,
        markRead,
        clearAll,
        subscribeToTask,
        onTaskProgress,
        onTaskComplete,
        onTaskFailed,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
