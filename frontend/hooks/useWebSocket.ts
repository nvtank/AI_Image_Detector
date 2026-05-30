/**
 * useWebSocket — Real-Time Notification Hook
 * ===========================================
 * Phase 5: WebSocket client with auto-reconnect, JWT auth, and
 * typed message dispatching.
 *
 * Features:
 *   - Connects with access token as query param
 *   - Auto-reconnect with exponential backoff (max 30s)
 *   - Heartbeat ping every 30s to keep connection alive
 *   - Typed message handlers via onMessage callback
 *   - Graceful cleanup on unmount
 *
 * Usage:
 *   const { sendMessage, isConnected } = useWebSocket({
 *     onMessage: (type, data) => { ... }
 *   });
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/api";

export type WSMessageType =
  | "connected"
  | "pong"
  | "task_progress"
  | "task_complete"
  | "task_failed"
  | "security_alert"
  | "system_health"
  | "stats";

export interface WSMessage {
  type: WSMessageType;
  data: Record<string, any>;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (msg: WSMessage) => void;
  enabled?: boolean;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

const PING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export function useWebSocket({ onMessage, enabled = true }: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const stopTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((type: string, data: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    const token = getAccessToken();
    if (!token) {
      // No access token yet — retry after a short delay
      reconnectTimerRef.current = setTimeout(connect, 3000);
      return;
    }

    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS; // Reset backoff

      // Start heartbeat
      pingTimerRef.current = setInterval(() => {
        sendMessage("ping");
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: WSMessage = JSON.parse(event.data);
        onMessageRef.current?.(msg);
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      stopTimers();

      // 4001 = unauthorized — don't reconnect (token invalid)
      if (event.code === 4001 || !mountedRef.current || !enabled) return;

      // Exponential backoff reconnect
      const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY_MS);
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // Will trigger onclose which handles reconnect
    };
  }, [enabled, sendMessage, stopTimers]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      stopTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect, enabled, stopTimers]);

  return { isConnected, sendMessage };
}
