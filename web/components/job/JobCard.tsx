import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postedLabel, deadlineLabel } from "@/lib/jobDates";
import type { Job } from "@/lib/types";

import { CompanyLogo } from "@/components/company/CompanyLogo";

import { VisaBadge } from "./VisaBadge";
import { RemoteBadge } from "./RemoteBadge";
import { RegisterVerifiedBadge } from "./RegisterVerifiedBadge";

function formatSalary(salary?: Job["salary"]): string | null {
  if (!salary) return null;
  const { min_usd, max_usd } = salary;
  if (!min_usd && !max_usd) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min_usd && max_usd) return `${k(min_usd)}–${k(max_usd)}`;
  return k((min_usd ?? max_usd)!);
}

// 카드 전체가 상세 페이지(/jobs/[id]) 링크. 외부 "지원" 버튼은 상세 페이지에만 둔다.
// hideVisaBadge: 이미 전부 스폰서인 맥락(홈 "비자 스폰서십" 섹션)에선 중복이라 비자 배지를 숨긴다.
export function JobCard({ job, hideVisaBadge = false }: { job: Job; hideVisaBadge?: boolean }) {
  const salary = formatSalary(job.salary);
  const posted = postedLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const metaParts = [job.location, job.is_remote ? "Remote" : null].filter(Boolean);
  const showVisa =
    !hideVisaBadge && (job.visa?.status === "sponsors" || job.visa?.status === "no_sponsor");
  const showRemote = job.remote?.eligibility === "worldwide" || job.remote?.eligibility === "apac_ok";
  // 명부 검증 골드 마커는 비자 배지를 숨기는 맥락(홈 스폰서 섹션)에서도 표시 — 스폰서 사이에서
  // "정부 명부 확인"을 구분해주는 신호이므로 중복이 아니다.
  const showVerified = job.visa?.register_verified === true;

  return (
    <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="group block h-full">
      <Card className="flex h-full flex-col transition-colors hover:border-primary/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} />
            <div className="min-w-0 flex-1">
              <CardTitle className="line-clamp-2 transition-colors group-hover:text-primary">
                {job.title}
              </CardTitle>
              <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">
                {job.company.display_name}
                {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}
              </p>
            </div>
          </div>
          {(showVisa || showRemote || showVerified) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {showVisa && <VisaBadge status={job.visa?.status} />}
              {showVerified && <RegisterVerifiedBadge />}
              <RemoteBadge eligibility={job.remote?.eligibility} />
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {job.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="font-mono lowercase">
                  {t}
                </Badge>
              ))}
              {job.tags.length > 4 && (
                <span className="text-caption text-muted-foreground">+{job.tags.length - 4}</span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            {salary && <span className="font-mono text-foreground">{salary}</span>}
            {posted && <span>{posted}</span>}
            <span className={deadline.urgent ? "text-foreground font-medium" : undefined}>
              {deadline.text}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
