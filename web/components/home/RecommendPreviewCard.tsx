import { Lightbulb } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { ScoreBreakdownBars } from "@/components/recommend/ScoreBreakdownBars";
import type { RecommendationItem } from "@/lib/types";

// 랜딩 "당신을 위한 6차원 매칭 공고" 카드. Readdy 목업: 큰 점수 + 6색 막대 + 근거 한 줄.
export function RecommendPreviewCard({ item }: { item: RecommendationItem }) {
  const { job, score } = item;
  const pct = Math.round(score.final_score * 100);
  const isSponsor = job.visa?.status === "sponsors";
  const remote =
    job.remote?.eligibility === "worldwide" || job.remote?.eligibility === "apac_ok";
  const reason = score.reasons?.[0];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="block">
            <h3 className="line-clamp-2 text-body font-semibold leading-snug transition-colors hover:text-primary">
              {job.title_ko ?? job.title}
            </h3>
          </Link>
          {job.title_ko && (
            <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">{job.title}</p>
          )}
          <p className="mt-1 truncate text-body-sm text-muted-foreground">
            {job.company.display_name}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
            {pct}
          </div>
          <div className="mt-0.5 text-caption text-muted-foreground">점</div>
        </div>
      </div>

      {(isSponsor || remote) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {isSponsor && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium text-success"
              style={{ backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)" }}
            >
              비자 스폰서
            </span>
          )}
          {remote && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium text-primary"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            >
              원격 가능
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex-1">
        <ScoreBreakdownBars score={score} />
      </div>

      {reason && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-caption text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span className="line-clamp-2">{reason}</span>
        </div>
      )}
    </div>
  );
}
