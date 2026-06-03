"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push("/billing");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        className="card text-center"
        style={{
          maxWidth: 420,
          width: "100%",
          padding: 48,
          borderRadius: "var(--r-xl)",
          background: "var(--canvas)",
          border: "1px solid var(--canvas-soft)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.1)",
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22c55e20, #22c55e40)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 40,
            animation: "pulse 2s ease-in-out 1",
          }}
        >
          🎉
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: 12,
          }}
        >
          Thanh toán thành công!
        </h1>

        <p style={{ color: "var(--body)", marginBottom: 8, lineHeight: 1.6 }}>
          Gói dịch vụ của bạn đã được kích hoạt. Cảm ơn bạn đã tin dùng AI Image Detector!
        </p>

        <p style={{ color: "var(--mute)", fontSize: 13, marginBottom: 32 }}>
          Tự động chuyển về trang Billing trong{" "}
          <strong style={{ color: "var(--primary)" }}>{countdown}s</strong>...
        </p>

        <Link
          href="/billing"
          className="btn-primary inline-block px-8 py-3 text-sm font-semibold"
          style={{ borderRadius: "var(--r-xl)" }}
        >
          Về trang Billing ngay →
        </Link>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
