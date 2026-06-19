"use client";

import { useMatchScore } from "@/lib/use-match-score";
import type { ScoreBreakdown } from "@/lib/types";

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, Number(n) || 0)) * 100);

// 모바일 하단바 좌측 매칭 점수. 로그인+프로필로 점수가 준비됐을 때만 노출(아니면 숨김).
export function MobileMatchScore({ jobId }: { jobId: string }) {
  const { state, score } = useMatchScore(jobId);
  if (state !== "ready" || !score) return null;
  return (
    <div className="shrink-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">매칭 점수</p>
      <p className="text-base font-extrabold leading-none tabular-nums text-foreground">
        {pct((score as ScoreBreakdown).final_score)}점
      </p>
    </div>
  );
}
