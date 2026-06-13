"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResumeOptimize } from "@/lib/types";

export function ResumeOptimizeSection({ jobId }: { jobId: string }) {
  const [resume, setResume] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeOptimize | null>(null);

  async function run() {
    if (!resume.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume-optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, resume_text: resume }),
      });
      if (!res.ok) {
        setError(`요청 실패 (HTTP ${res.status})`);
        return;
      }
      setResult((await res.json()) as ResumeOptimize);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const pct = result ? Math.round(result.match_score * 100) : 0;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface-2 p-5">
      <div className="space-y-1">
        <div className="text-caption font-semibold uppercase tracking-wide text-primary">
          키워드 매칭 · AI 없이 즉시
        </div>
        <h2 className="text-h3">이력서 최적화</h2>
        <p className="text-body-sm text-muted-foreground">
          붙여넣은 이력서를 이 공고 키워드와 바로 대조해 보유·부족 키워드와 강조 포인트를 알려줘요.
          로그인·AI 없이 무료이고, 입력은 저장되지 않아요.
        </p>
      </div>

      <textarea
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        rows={6}
        placeholder="이력서 텍스트를 붙여넣으세요 (한 줄에 한 항목)"
        className="w-full rounded-md border border-input bg-background p-3 text-body-sm font-mono"
      />
      <Button onClick={run} disabled={loading || !resume.trim()}>
        {loading ? "분석 중…" : "최적화 분석"}
      </Button>

      {error && <p className="text-body-sm text-red-500">{error}</p>}

      {result && (
        <div className="space-y-4 rounded-md border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="text-h2 font-semibold tabular-nums">{pct}%</span>
            <span className="text-body-sm text-muted-foreground">
              공고 키워드 매칭 ({result.present_keywords.length}/{result.job_keywords.length})
            </span>
          </div>

          {result.present_keywords.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-body-sm font-medium">이력서에 있는 키워드</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.present_keywords.map((k) => (
                  <Badge key={k} className="font-mono lowercase">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.missing_keywords.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-body-sm font-medium">누락된 키워드</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_keywords.map((k) => (
                  <Badge key={k} variant="outline" className="font-mono lowercase text-muted-foreground">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-body-sm font-medium">제안</h4>
              <ul className="space-y-1.5 text-body-sm text-foreground/90">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">→</span>
                    <span className="whitespace-pre-line">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.reordered_lines.some((l) => l.score > 0) && (
            <div className="space-y-1.5">
              <h4 className="text-body-sm font-medium">매칭 점수순 줄 재배치</h4>
              <ol className="space-y-1.5 text-body-sm">
                {result.reordered_lines
                  .filter((l) => l.score > 0)
                  .map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {l.score}
                      </span>
                      <span className="text-foreground/90">{l.line}</span>
                    </li>
                  ))}
              </ol>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{result.note}</p>
        </div>
      )}

      <Link
        href="/me/coach"
        className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5 text-body-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-muted-foreground">
          더 깊은 조언이 필요하면 <span className="font-medium text-foreground">이력서 코치</span>에서 AI와 1:1 상담받아요
        </span>
        <span className="shrink-0 text-primary" aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
