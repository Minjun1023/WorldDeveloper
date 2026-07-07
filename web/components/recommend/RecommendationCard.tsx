import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Card } from "@/components/ui/card";
import { locationDisplayParts } from "@/lib/jobLocation";
import { formatSalary, formatSalaryKrw } from "@/lib/salary";
import { filterTechTags } from "@/lib/techTags";
import type { RecommendationItem } from "@/lib/types";

import { ScoreRadar } from "./ScoreRadar";

export function RecommendationCard({
  item,
  rank,
  actions,
}: {
  item: RecommendationItem;
  rank: number;
  actions?: React.ReactNode;
}) {
  const { job, score } = item;
  const location = locationDisplayParts(job, "Remote").join(", ");
  const matchPct = Math.round(score.final_score * 100);
  const salary = formatSalary(job.salary);
  const salaryKrw = formatSalaryKrw(job.salary);
  const techTags = filterTechTags(job.tags, job.company).slice(0, 3);
  const visaLabel = job.visa?.register_verified
    ? "비자 검증"
    : job.visa?.status === "sponsors"
      ? "비자 스폰서"
      : null;
  const reasons = score.reasons.slice(0, 3);

  return (
    // h-full: 그리드 셀 높이에 맞춰 늘어나 같은 행 카드 높이를 통일.
    <Card className="flex h-full flex-col p-5">
      {/* 헤더: 로고 + (순위·매칭점수·검증 / 북마크) + 제목 + 회사·지역 */}
      <div className="flex items-start gap-3">
        <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-caption font-mono text-muted-foreground">#{rank}</span>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-caption font-bold text-primary-foreground">
                매칭 {matchPct}점
              </span>
              {visaLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-0.5 text-caption font-semibold text-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {visaLabel}
                </span>
              )}
            </div>
            {actions && (
              <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">{actions}</div>
            )}
          </div>
          <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
            <h3 className="mt-1.5 line-clamp-2 text-h3 font-bold leading-tight text-foreground transition-colors hover:text-primary">
              {job.title_ko ?? job.title}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-1 text-body-sm text-muted-foreground">
            {[job.company.display_name, location].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* 5축 매칭 레이더 */}
      <div className="flex justify-center py-3">
        <ScoreRadar score={score} size={176} />
      </div>

      {/* 추천 이유 칩 */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reasons.map((r, i) => (
            <span
              key={i}
              className="rounded-full bg-primary-tint px-3 py-1.5 text-caption font-semibold text-primary"
            >
              {r}
            </span>
          ))}
        </div>
      )}
      {score.deal_breakers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {score.deal_breakers.slice(0, 2).map((d, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-3 py-1.5 text-caption font-medium text-destructive"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* 하단: 연봉(좌) + 스택 칩(우) */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {salary ? (
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight text-foreground">{salaryKrw ?? salary}</span>
            {salaryKrw && <span className="text-caption font-normal text-muted-foreground">{salary}</span>}
          </span>
        ) : (
          <span aria-hidden />
        )}
        {techTags.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {techTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2.5 py-1 text-caption font-medium lowercase text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
