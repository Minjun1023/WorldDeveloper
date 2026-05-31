"use client";

import DOMPurify from "isomorphic-dompurify";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/types";

type View = "original" | "ko";

export function JobDescription({ jobId, original }: { jobId: string; original: string }) {
  const [view, setView] = useState<View>("original");
  const [ko, setKo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  // 외부 소스 HTML이라 XSS 방지를 위해 DOMPurify로 살균 후 렌더.
  const safeHtml = DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">상세 설명</h2>
        <div className="flex items-center gap-1.5 text-body-sm">
          <button
            type="button"
            onClick={() => setView("original")}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              view === "original"
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            원문
          </button>
          <button
            type="button"
            onClick={showKorean}
            disabled={loading}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              view === "ko"
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
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

      <div
        className="job-desc text-body text-foreground/90"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </section>
  );
}
