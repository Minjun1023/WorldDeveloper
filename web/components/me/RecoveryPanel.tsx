"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recovery } from "@/lib/types";

export function RecoveryPanel({
  jobId,
  onRecovered,
}: {
  jobId: string;
  onRecovered?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Recovery | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, reason, mark_rejected: true }),
      });
      if (!res.ok) {
        setError(`요청 실패 (HTTP ${res.status})`);
        return;
      }
      setResult((await res.json()) as Recovery);
      onRecovered?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-caption text-muted-foreground hover:text-foreground"
      >
        거절 회복 도움 →
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-surface-2 p-4">
      {!result ? (
        <>
          <p className="text-body-sm text-muted-foreground">
            거절을 기록하고 다음 단계를 제안받습니다. (지원 상태가 &lsquo;거절&rsquo;로 바뀝니다)
          </p>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="거절 사유 (선택)"
          />
          <div className="flex gap-2">
            <Button onClick={run} disabled={loading}>
              {loading ? "처리 중…" : "회복 키트 받기"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </div>
          {error && <p className="text-body-sm text-red-500">{error}</p>}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-body-sm text-foreground/90">{result.encouragement}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            <span>지원 {result.stats.total_applications}건</span>
            <span>거절 {result.stats.rejected_count}건</span>
            <span>거절률 {Math.round(result.stats.rejection_rate * 100)}%</span>
          </div>

          {result.similar_companies.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-body-sm font-medium">비슷한 회사 (태그: {result.shared_tags.join(", ")})</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.similar_companies.map((c) => (
                  <Link key={c.slug} href={`/companies/${c.slug}`}>
                    <Badge variant="outline" className="hover:border-primary">
                      {c.display_name} ({c.job_count})
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h4 className="text-body-sm font-medium">다음 단계</h4>
            <ul className="space-y-1.5 text-body-sm text-foreground/90">
              {result.next_actions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">→</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button variant="secondary" onClick={() => setOpen(false)}>
            닫기
          </Button>
        </div>
      )}
    </div>
  );
}
