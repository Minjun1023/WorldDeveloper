import { Clock } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RegisterVerifiedBadge } from "@/components/job/RegisterVerifiedBadge";
import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import type { Job } from "@/lib/types";

// 검색 결과 행: 한 화면 스캔량 우선. 신호 배지 최대 1(명부검증 > 스폰서불가) + 마감임박, 태그 최대 3(sm+).
export function JobRow({ job }: { job: Job }) {
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const flag = flagFromLocation(job.location);
  const loc = [job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ");
  // 레벨(시니어리티): "senior" → "Senior". 검색 결과에서 한눈에 직급 파악.
  const level = job.seniority ? job.seniority.charAt(0).toUpperCase() + job.seniority.slice(1) : null;

  return (
    <Link
      href={`/jobs/${encodeURIComponent(job.id)}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-body font-bold text-foreground group-hover:text-primary">{job.title_ko ?? job.title}</span>
          {job.visa?.register_verified ? (
            <RegisterVerifiedBadge />
          ) : job.visa?.status === "no_sponsor" ? (
            <span
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-caption font-semibold text-destructive"
              style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}
            >
              스폰서 불가
            </span>
          ) : null}
          {deadline.urgent && (
            <span
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-caption font-semibold text-warning"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 14%, transparent)" }}
            >
              마감 임박
            </span>
          )}
        </div>
        {job.title_ko && (
          <div className="truncate text-caption text-muted-foreground">{job.title}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-body-sm text-muted-foreground">
          <span className="truncate">
            {job.company.display_name}
            {loc ? ` · ${flag ? `${flag} ` : ""}${loc}` : ""}
            {level ? ` · ${level}` : ""}
          </span>
        </div>
        {job.tags && job.tags.length > 0 && (
          <div className="mt-1.5 hidden flex-wrap gap-1.5 sm:flex">
            {job.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-caption lowercase text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {posted && (
        <div className="flex shrink-0 items-center justify-end gap-1 text-caption text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {posted}
        </div>
      )}
    </Link>
  );
}
