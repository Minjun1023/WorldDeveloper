"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/types";

type View = "original" | "ko";

// HTML 태그 제거 — DOMPurify 로드 전(SSR/하이드레이션 직전)의 안전한 평문 폴백.
// 텍스트 노드로만 렌더되므로 스크립트 실행/XSS 위험 없음.
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function JobDescription({ jobId, original }: { jobId: string; original: string }) {
  const [view, setView] = useState<View>("original");
  const [ko, setKo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  async function showKorean() {
    if (ko) {
      setView("ko");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, lang: "ko" }),
      });
      if (res.status === 503) {
        setError("번역을 사용할 수 없습니다 (번역 API 키 미설정).");
        return;
      }
      if (!res.ok) {
        setError(`번역 실패 (HTTP ${res.status}).`);
        return;
      }
      const data = (await res.json()) as Translation;
      setKo(data.description);
      setView("ko");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const text = view === "ko" && ko ? ko : original;

  // 외부 소스 HTML이라 XSS 방지를 위해 DOMPurify로 살균. DOMPurify(dompurify)는 브라우저 전용이라
  // 클라이언트에서만 동적 로드한다 — isomorphic-dompurify를 정적 import 하면 jsdom이 서버 번들에
  // 끌려와 App Router SSR(공고 상세)이 깨진다. 살균 전에는 평문 폴백을 렌더(SSR 콘텐츠 + 무XSS).
  useEffect(() => {
    let alive = true;
    setSafeHtml(null);
    import("dompurify").then((mod) => {
      const purified = mod.default.sanitize(text, { USE_PROFILES: { html: true } });
      if (alive) setSafeHtml(purified);
    });
    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">상세 설명</h2>
        <div className="flex items-center rounded-[10px] border border-border p-0.5 text-body-sm">
          <button
            type="button"
            onClick={() => setView("original")}
            className={cn(
              "rounded-lg px-3 py-1 font-semibold transition-colors",
              view === "original" ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            원문
          </button>
          <button
            type="button"
            onClick={showKorean}
            disabled={loading}
            className={cn(
              "rounded-lg px-3 py-1 font-semibold transition-colors",
              view === "ko" ? "bg-primary/10 text-primary" : "text-primary hover:bg-primary/5",
            )}
          >
            {loading ? "번역 중…" : "한국어로 보기"}
          </button>
        </div>
      </div>

      {error && <p className="text-body-sm text-red-500">{error}</p>}

      {view === "ko" && ko && (
        <p className="text-caption text-muted-foreground">기계 번역 — 오역이 있을 수 있습니다.</p>
      )}

      {safeHtml === null ? (
        <div className="job-desc whitespace-pre-line text-body text-foreground/90">
          {stripTags(text)}
        </div>
      ) : (
        <div
          className="job-desc text-body text-foreground/90"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )}
    </section>
  );
}
