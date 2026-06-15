"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/types";

type View = "original" | "ko";

// HTML 태그 제거 — DOMPurify 로드 전(SSR/하이드레이션 직전)의 안전한 평문 폴백.
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function JobDescription({ jobId, original, initialKo }: {
  jobId: string; original: string; initialKo?: string | null;
}) {
  const [view, setView] = useState<View>("ko"); // 기본 한국어
  const [ko, setKo] = useState<string | null>(initialKo ?? null);
  const [loading, setLoading] = useState(!initialKo); // 서버 캐시로 받으면 로딩 없음(즉시 표시)
  const [failed, setFailed] = useState(false); // 번역 실패/비활성 → 원문 폴백
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  // 마운트 시 자동 번역(공고당 1회, 백엔드 캐시). 서버가 캐시된 번역(initialKo)을 줬으면 클라 호출 생략.
  useEffect(() => {
    if (initialKo) return; // 이미 SSR 로 한국어 확보 → fetch 불필요
    let alive = true;
    setLoading(true);
    setKo(null);
    setFailed(false);
    setView("ko");
    fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: jobId, lang: "ko" }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Translation;
        if (!alive) return;
        if (data.description) {
          setKo(data.description);
        } else {
          setFailed(true);
          setView("original");
        }
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
          setView("original");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [jobId, initialKo]);

  const text = view === "ko" && ko ? ko : original;

  // 외부 소스 HTML이라 XSS 방지를 위해 DOMPurify로 살균(클라이언트 전용 동적 로드).
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
    <section className="space-y-2 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">상세 설명</h2>
        {!failed && (
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
              onClick={() => setView("ko")}
              disabled={loading}
              className={cn(
                "rounded-lg px-3 py-1 font-semibold transition-colors",
                view === "ko" ? "bg-primary/10 text-primary" : "text-primary hover:bg-primary/5",
              )}
            >
              {loading && view === "ko" ? "번역 중…" : "한국어"}
            </button>
          </div>
        )}
      </div>

      {failed && (
        <p className="text-caption text-muted-foreground">번역을 사용할 수 없어 원문을 표시합니다.</p>
      )}
      {view === "ko" && ko && (
        <p className="text-caption text-muted-foreground">기계 번역 — 오역이 있을 수 있습니다.</p>
      )}
      {view === "ko" && !ko && !failed && (
        <p className="text-caption text-muted-foreground">번역 중… (원문 표시 중)</p>
      )}

      {safeHtml === null ? (
        <div className="job-desc whitespace-pre-line text-body text-foreground/90">{stripTags(text)}</div>
      ) : (
        <div className="job-desc text-body text-foreground/90" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}
    </section>
  );
}
