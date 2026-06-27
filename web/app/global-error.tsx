"use client";

import { useEffect } from "react";

// 루트 레이아웃 자체가 throw 할 때의 최후 폴백 — 루트 레이아웃을 대체하므로
// 자체 <html>/<body> 를 렌더하고 globals.css 토큰 없이 인라인 스타일로 자립.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#191f28",
          background: "#ffffff",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>문제가 발생했어요</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "#4e5968", maxWidth: 360 }}>
          일시적인 오류로 페이지를 표시하지 못했어요. 잠시 후 다시 시도해주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 24,
            border: "none",
            borderRadius: 6,
            background: "#0064ff",
            color: "#ffffff",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
