import { Clock } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RegisterVerifiedBadge } from "@/components/job/RegisterVerifiedBadge";
import { RemoteBadge } from "@/components/job/RemoteBadge";
import { Card } from "@/components/ui/card";
import { postedRelativeLabel } from "@/lib/jobDates";
import { formatSalary } from "@/lib/salary";
import type { Job } from "@/lib/types";

// 최신 비자 스폰서십 공고 카드(2열). 명부 검증은 배지로만 표시(근거 원문 문장은 상세 페이지에서).
export function SponsorJobCard({ job }: { job: Job }) {
  const salary = formatSalary(job.salary);
  const posted = postedRelativeLabel(job.posted_at);
  const locText = (job.location_ko ?? job.location) || (job.is_remote ? "원격" : null);
  const verified = job.visa?.register_verified === true;

  return (
    <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="group block h-full">
      <Card className="flex h-full flex-col rounded-lg p-5 transition-colors hover:border-primary/40">
        {/* 헤더: 로고 + 제목/회사(+명부검증) + 게시일 */}
        <div className="flex items-start gap-3">
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-body font-semibold leading-snug transition-colors group-hover:text-primary">
              {job.title_ko ?? job.title}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-muted-foreground">
              <span className="truncate">{job.company.display_name}</span>
              {/* 명부 검증은 골드 방패 아이콘만(텍스트 제거) — 의미는 title/aria-label 로 전달. */}
              {verified && <RegisterVerifiedBadge />}
            </div>
          </div>
          {posted && (
            <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {posted}
            </span>
          )}
        </div>

        {/* 위치 · 원격 · 연봉 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm">
          {locText && (
            <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
              <span className="truncate">{locText}</span>
            </span>
          )}
          <RemoteBadge eligibility={job.remote?.eligibility} />
          {salary && <span className="font-semibold text-foreground">{salary}</span>}
        </div>

        <div className="min-h-2 flex-1" aria-hidden="true" />

        {/* 기술 태그 */}
        {job.tags && job.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {job.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-caption lowercase text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
