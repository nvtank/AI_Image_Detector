"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PaymentCancelPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

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
        {/* Cancel icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 40,
          }}
        >
          ✕
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: 12,
          }}
        >
          Giao dịch đã bị huỷ
        </h1>

        <p style={{ color: "var(--body)", marginBottom: 8, lineHeight: 1.6 }}>
          Bạn đã huỷ giao dịch thanh toán. Gói dịch vụ của bạn chưa thay đổi.
        </p>

        <p style={{ color: "var(--mute)", fontSize: 13, marginBottom: 32 }}>
          Tự động chuyển về trang Billing trong{" "}
          <strong style={{ color: "var(--primary)" }}>{countdown}s</strong>...
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/billing"
            className="btn-primary inline-block px-8 py-3 text-sm font-semibold text-center"
            style={{ borderRadius: "var(--r-xl)" }}
          >
            Thử lại →
          </Link>
          <Link
            href="/upload"
            style={{
              color: "var(--mute)",
              fontSize: 13,
              textDecoration: "underline",
              textAlign: "center",
            }}
          >
            Tiếp tục không nâng cấp
          </Link>
        </div>
      </div>
    </div>
  );
}
