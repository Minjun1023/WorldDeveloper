import { Building2, MapPin } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SaveHeartButton } from "@/components/job/SaveHeartButton";
import { postedRelativeLabel } from "@/lib/jobDates";
import { locationDisplayParts } from "@/lib/jobLocation";
import { formatSalary, formatSalaryKrw } from "@/lib/salary";
import { filterTechTags } from "@/lib/techTags";
import type { Job } from "@/lib/types";

// 검색/최신 공고 행 — Figma 카드: 아바타 + 한글제목·영문 + 🏢회사·📍위치·연봉 + 기술칩 + 우측 게시일·하트.
// 전체 행 클릭 = 상세 이동(stretched link), 우측 하트 = 관심 저장.
export function JobRow({ job, loggedIn = false, saved = false }: { job: Job; loggedIn?: boolean; saved?: boolean }) {
  const posted = postedRelativeLabel(job.posted_at);
  const loc = locationDisplayParts(job).join(" · ");
  const salary = formatSalaryKrw(job.salary) ?? formatSalary(job.salary);
  const techTags = filterTechTags(job.tags, job.company);

  return (
    <div className="group relative flex items-start gap-4 rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-sm">
      <Link
        href={`/jobs/${encodeURIComponent(job.id)}`}
        aria-label={job.title_ko ?? job.title}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={44} />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body-sm font-bold text-foreground group-hover:text-primary">
          {job.title_ko ?? job.title}
        </h3>
        {job.title_ko && <p className="truncate text-caption text-muted-foreground">{job.title}</p>}

        {/* 회사·위치·연봉 한 줄 고정: 줄바꿈 없이, 길면 위치만 말줄임. */}
        <div className="mt-2 flex min-w-0 items-center gap-x-3 text-caption text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {job.company.display_name}
          </span>
          {loc && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{loc}</span>
            </span>
          )}
          {salary && <span className="shrink-0 font-bold tabular-nums text-primary">{salary}</span>}
        </div>

        {techTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {techTags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-caption lowercase text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {posted && <span className="whitespace-nowrap text-caption text-muted-foreground">{posted}</span>}
        <SaveHeartButton jobId={job.id} loggedIn={loggedIn} initialSaved={saved} />
      </div>
    </div>
  );
}
