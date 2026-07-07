import { ImageResponse } from "next/og";

// 링크 공유 미리보기 이미지(1200×630) — 브랜드 D 마크 + 워드마크 + 태그라인을 동적 생성.
// 정적 PNG 를 따로 관리하지 않아 브랜드 변경 시 코드만 고치면 된다.
export const runtime = "edge";
export const alt = "DevPass — 한국 개발자의 해외 취업, 비자 스폰서십 공고 모음";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#0064ff",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* D 레터마크 (BrandMark 와 동일 지오메트리) */}
          <svg width="96" height="96" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="11" fill="#ffffff" />
            <path
              fill="#0064ff"
              fillRule="evenodd"
              d="M12 10 H23 A14 14 0 0 1 23 38 H12 Z M18 16 V32 H23 A8 8 0 0 0 23 16 Z"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -3 }}>
            DevPass
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 34, opacity: 0.92 }}>
          한국 개발자의 해외 취업, 비자부터 확인하세요
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.75 }}>
          비자 스폰서십 검증 공고 · 5축 매칭 점수 · AI 이력서 코치
        </div>
      </div>
    ),
    size,
  );
}
