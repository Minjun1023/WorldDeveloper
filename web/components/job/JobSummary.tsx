"use client";

import { useState } from "react";

import type { JobSummary as JobSummaryData } from "@/lib/types";

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

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">AI 요약</h2>
        {!data && (
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md px-2.5 py-1 text-body-sm text-primary hover:underline disabled:text-muted-foreground"
          >
            {loading ? "요약 중…" : "AI 요약 보기"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-body-sm text-destructive">{error}</p>}

      {data && nonEmpty.length === 0 && (
        <p className="mt-2 text-body-sm text-muted-foreground">요약할 핵심 정보를 찾지 못했습니다.</p>
      )}

      {data && nonEmpty.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {nonEmpty.map((s) => (
            <div key={s.key} className="rounded-md border border-border bg-surface p-3.5">
              <h3 className="text-body-sm font-semibold">{s.label}</h3>
              <ul className="mt-1.5 space-y-1 text-body-sm text-muted-foreground">
                {(data[s.key] as string[]).map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
