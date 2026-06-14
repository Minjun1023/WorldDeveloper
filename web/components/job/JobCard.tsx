import { Clock } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Card } from "@/components/ui/card";
import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import { formatSalary } from "@/lib/salary";
import type { Job } from "@/lib/types";

import { RegisterVerifiedBadge } from "./RegisterVerifiedBadge";
import { RemoteBadge } from "./RemoteBadge";
import { VisaBadge } from "./VisaBadge";

// 카드 전체가 상세 페이지(/jobs/[id]) 링크. 외부 "지원" 버튼은 상세 페이지에만 둔다.
// hideVisaBadge: 이미 전부 스폰서인 맥락(홈 "비자 스폰서십" 섹션)에선 중복이라 비자 배지를 숨긴다.
export function JobCard({ job, hideVisaBadge = false }: { job: Job; hideVisaBadge?: boolean }) {
  const salary = formatSalary(job.salary);
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const flag = flagFromLocation(job.location);
  const locText = (job.location_ko ?? job.location) || (job.is_remote ? "원격" : null);
  // VisaBadge 가 실제로 렌더하는 상태만 true(sponsors 는 null 이라 제외). unclear 는 중립
  // "비자 정보 없음" 라벨로 정직하게 노출(opt-in 으로 미확인 공고를 켰을 때만 등장).
  const showVisa =
    !hideVisaBadge && (job.visa?.status === "no_sponsor" || job.visa?.status === "unclear");
  const showRemote =
    job.remote?.eligibility === "worldwide" || job.remote?.eligibility === "apac_ok";
  // 명부 검증 골드 마커는 비자 배지를 숨기는 맥락(홈 스폰서 섹션)에서도 표시 — 스폰서 사이에서
  // "정부 명부 확인"을 구분해주는 신호이므로 중복이 아니다.
  const showVerified = job.visa?.register_verified === true;
  const hasBadges = showVisa || showRemote || showVerified;

  return (
    <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="group block h-full">
      <Card className="flex h-full flex-col rounded-xl p-5 transition-all hover:border-primary/40 hover:shadow-md">
        {/* 헤더: 로고 + 제목/회사·지역 + (마감 임박) */}
        <div className="flex items-start gap-3">
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-body font-semibold leading-snug transition-colors group-hover:text-primary">
              {job.title_ko ?? job.title}
            </h3>
            {job.title_ko && (
              <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">{job.title}</p>
            )}
            <p className="mt-1 flex min-w-0 items-center gap-1 text-body-sm text-muted-foreground">
              <span className="truncate">{job.company.display_name}</span>
              {locText && (
                <>
                  <span aria-hidden="true">·</span>
                  {flag && (
                    <span aria-hidden="true" className="shrink-0">
                      {flag}
                    </span>
                  )}
                  <span className="truncate">{locText}</span>
                </>
              )}
            </p>
          </div>
          {deadline.urgent && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-caption font-medium text-warning"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 14%, transparent)" }}
            >
              마감 임박
            </span>
          )}
        </div>

        {/* 신호 배지 */}
        {hasBadges && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {showVisa && <VisaBadge status={job.visa?.status} />}
            {showVerified && <RegisterVerifiedBadge />}
            <RemoteBadge eligibility={job.remote?.eligibility} />
          </div>
        )}

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
            {job.tags.length > 4 && (
              <span className="text-caption text-muted-foreground">+{job.tags.length - 4}</span>
            )}
          </div>
        )}

        <div className="min-h-4 flex-1" aria-hidden="true" />

        {/* 푸터: 연봉 + 게시일 (구분선 위, 하단 정렬) */}
        <div className="flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            {salary ? (
              <>
                <div className="truncate text-body-sm font-semibold text-foreground">{salary}</div>
                <div className="text-caption text-muted-foreground">연봉 추정</div>
              </>
            ) : (
              <div className="text-caption text-muted-foreground">{deadline.text}</div>
            )}
          </div>
          {posted && (
            <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {posted}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
