import { Clock } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import type { Job } from "@/lib/types";

function salaryText(salary?: Job["salary"]): string | null {
  if (!salary) return null;
  const { min_usd, max_usd } = salary;
  if (!min_usd && !max_usd) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min_usd && max_usd) return `${k(min_usd)}–${k(max_usd)}`;
  return k((min_usd ?? max_usd)!);
}

// 검색 결과 행: 한 화면 스캔량 우선. 신호 배지 최대 1(명부검증 > 스폰서불가) + 마감임박, 태그 최대 3(sm+).
export function JobRow({ job }: { job: Job }) {
  const salary = salaryText(job.salary);
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const flag = flagFromLocation(job.location);
  const loc = [job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/jobs/${encodeURIComponent(job.id)}`}
      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-2/60"
    >
      <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-body font-bold text-foreground group-hover:text-primary">{job.title}</span>
          {job.visa?.register_verified ? (
            <span
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-caption font-semibold text-verified"
              style={{ backgroundColor: "color-mix(in srgb, var(--verified) 14%, transparent)" }}
            >
              명부검증
            </span>
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
        <div className="mt-0.5 flex items-center gap-1 text-body-sm text-muted-foreground">
          <span className="truncate">
            {job.company.display_name}
            {loc ? ` · ${flag ? `${flag} ` : ""}${loc}` : ""}
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

      <div className="shrink-0 text-right">
        {salary && <div className="text-body-sm font-bold text-foreground">{salary}</div>}
        {posted && (
          <div className="mt-0.5 flex items-center justify-end gap-1 text-caption text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {posted}
          </div>
        )}
      </div>
    </Link>
  );
}
