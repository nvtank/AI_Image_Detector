"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function GithubCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginWithGithub } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Thiếu authorization code từ GitHub.");
      setTimeout(() => {
        router.replace("/login");
      }, 3000);
      return;
    }

    const authenticate = async () => {
      try {
        await loginWithGithub(code);
        router.replace("/upload");
      } catch (err: any) {
        setError(err.message || "Đăng nhập bằng GitHub thất bại.");
        setTimeout(() => {
          router.replace("/login");
        }, 4000);
      }
    };

    authenticate();
  }, [searchParams, loginWithGithub, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--sp-md)",
          padding: "var(--sp-3xl) var(--sp-2xl)",
          borderRadius: "var(--r-xl)",
          maxWidth: 400,
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--sp-xs)" }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--negative)", margin: 0 }}>
              Đăng nhập thất bại
            </h2>
            <p style={{ color: "var(--body)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              {error}
            </p>
            <p style={{ color: "var(--mute)", fontSize: 12, margin: 0 }}>
              Đang quay lại trang đăng nhập...
            </p>
          </>
        ) : (
          <>
            <div
              className="spinner"
              style={{
                width: 40,
                height: 40,
                borderColor: "var(--canvas-soft)",
                borderTopColor: "var(--primary)",
              }}
            />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0, marginTop: "0.5rem" }}>
              Đang xác thực với GitHub
            </h2>
            <p style={{ color: "var(--mute)", fontSize: 14, margin: 0 }}>
              Vui lòng đợi trong giây lát...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GithubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      }
    >
      <GithubCallbackContent />
    </Suspense>
  );
}
