"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import type { JobSummary as JobSummaryData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS: { key: keyof Pick<JobSummaryData, "responsibilities" | "requirements" | "visa" | "compensation">; label: string }[] = [
  { key: "responsibilities", label: "주요 업무" },
  { key: "requirements", label: "자격 요건" },
  { key: "visa", label: "비자·이주" },
  { key: "compensation", label: "연봉·복지" },
];

export function JobSummary({ jobId, initialData }: { jobId: string; initialData?: JobSummaryData | null }) {
  const [data, setData] = useState<JobSummaryData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/job-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, lang: "ko" }),
      });
      if (res.status === 503) {
        setError("AI 요약을 사용할 수 없습니다 (API 키 미설정).");
        return;
      }
      if (res.status === 429) {
        setError("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (!res.ok) {
        setError(`요약 실패 (HTTP ${res.status}).`);
        return;
      }
      setData((await res.json()) as JobSummaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const nonEmpty = data
    ? SECTIONS.filter((s) => (data[s.key] as string[]).length > 0)
    : [];
  const hasBody = nonEmpty.length > 0;

  // 본문(흰 카드)과 구분되는 액센트 패널 — 'AI 보조'임을 시각적으로 분리한다.
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-h3 text-primary">AI 요약</h2>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden text-caption text-muted-foreground sm:inline">원문에서 핵심만 추출</span>
          {!data && (
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-md px-2.5 py-1 text-body-sm font-medium text-primary hover:underline disabled:text-muted-foreground"
            >
              {loading ? "요약 중…" : "AI 요약 보기"}
            </button>
          )}
          {hasBody && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-surface px-2.5 py-1 text-caption font-semibold text-primary hover:bg-primary/10"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} aria-hidden="true" />
              {collapsed ? "펼치기" : "접기"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-body-sm text-destructive">{error}</p>}

      {data && nonEmpty.length === 0 && (
        <p className="mt-2 text-body-sm text-muted-foreground">요약할 핵심 정보를 찾지 못했습니다.</p>
      )}

      {data && hasBody && !collapsed && (
        // Figma 형식: 섹션마다 작은 대문자 라벨(위) + 내용(아래) 스택. 좌측 라벨 카드 제거.
        <div className="mt-4 space-y-4">
          {nonEmpty.map((s) => (
            <div key={s.key}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <ul className="space-y-1.5 text-body-sm leading-relaxed text-foreground">
                {(data[s.key] as string[]).map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
