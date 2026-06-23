"use client";

import { useEffect, useState } from "react";

import { stripOrphanHeadings } from "@/lib/descHtml";

// HTML 태그 제거 — DOMPurify 로드 전(SSR/하이드레이션 직전)의 안전한 평문 폴백.
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 공고 원문(영문) 본문. 한국어 핵심 내용은 위의 AI 요약(JobSummary)이 담당한다.
export function JobDescription({ original }: { original: string }) {
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  // 외부 소스 HTML이라 XSS 방지를 위해 DOMPurify로 살균(클라이언트 전용 동적 로드).
  useEffect(() => {
    let alive = true;
    setSafeHtml(null);
    import("dompurify").then((mod) => {
      const purified = mod.default.sanitize(original, { USE_PROFILES: { html: true } });
      // 보일러플레이트 제거로 남은 고아 제목(예: "개인정보 및 AI 가이드라인:")을 다듬는다.
      if (alive) setSafeHtml(stripOrphanHeadings(purified));
    });
    return () => {
      alive = false;
    };
  }, [original]);

  return (
    <section className="space-y-2 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-h3">상세 설명</h2>
      {safeHtml === null ? (
        <div className="job-desc whitespace-pre-line text-body text-foreground/90">{stripTags(original)}</div>
      ) : (
        <div className="job-desc text-body text-foreground/90" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}
    </section>
  );
}
