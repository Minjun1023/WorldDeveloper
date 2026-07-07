import { Clock } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SaveHeartButton } from "@/components/job/SaveHeartButton";
import { Card } from "@/components/ui/card";
import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import { fallbackMetaChip } from "@/lib/jobMeta";
import { formatSalary, formatSalaryKrw } from "@/lib/salary";
import { filterTechTags } from "@/lib/techTags";
import { TIER_LABEL, TIER_NOTE, visaEvidenceTier } from "@/lib/visa-evidence";
import type { Job } from "@/lib/types";

import { RemoteBadge } from "./RemoteBadge";
import { VisaBadge } from "./VisaBadge";

// 카드 전체가 상세 페이지(/jobs/[id]) 링크. 외부 "지원" 버튼은 상세 페이지에만 둔다.
// hideVisaBadge: 이미 전부 스폰서인 맥락(홈 "비자 스폰서십" 섹션)에선 중복이라 비자 배지를 숨긴다.
export function JobCard({
  job,
  hideVisaBadge = false,
  showRestrictedRemote = false,
  showSave = false,
  loggedIn = false,
  matchScore,
  matchReasons,
}: {
  job: Job;
  hideVisaBadge?: boolean;
  // 회사 페이지 등에서 '원격 가능 공고'를 모두 표기하고 싶을 때 지역 제한 원격도 배지로 노출.
  showRestrictedRemote?: boolean;
  // 우상단 북마크(저장) 노출 — 인기 TOP 공고 등 opt-in.
  showSave?: boolean;
  loggedIn?: boolean;
  // 맞춤 추천 맥락에서 카드 안에 매칭 점수(0~100)를 표기 — 홈 추천 미리보기 등 opt-in.
  matchScore?: number;
  // 맞춤 추천 사유 칩("비자 스폰서십 명시" 등) — 추천 맥락 opt-in.
  matchReasons?: string[];
}) {
  const salary = formatSalary(job.salary);
  const salaryKrw = formatSalaryKrw(job.salary);
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const techTags = filterTechTags(job.tags, job.company);
  const metaChip = techTags.length === 0 ? fallbackMetaChip(job) : null;
  const flag = flagFromLocation(job.location);
  const locText = (job.location_ko ?? job.location) || (job.is_remote ? "원격" : null);
  // VisaBadge 가 실제로 렌더하는 상태만 true(sponsors 는 null 이라 제외). unclear 는 중립
  // "비자 정보 없음" 라벨로 정직하게 노출(opt-in 으로 미확인 공고를 켰을 때만 등장).
  const showVisa =
    !hideVisaBadge && (job.visa?.status === "no_sponsor" || job.visa?.status === "unclear");
  const showRemote =
    job.remote?.eligibility === "worldwide" || job.remote?.eligibility === "apac_ok";
  const showRestricted =
    showRestrictedRemote &&
    !showRemote &&
    (job.remote?.eligibility === "region_restricted" || job.is_remote === true);
  // sponsors 근거 등급 — 본문 직접 명시(레어·최강 신호)는 강조, 간접(회사 이력 전파)은 중립 마커로
  // 정직하게 구분. 대다수(명부 검증)는 배지 생략 — 84% 에 배지를 달면 변별력이 없어 노이즈.
  const evidenceTier = visaEvidenceTier(job.visa);
  const showEvidenceTier = evidenceTier === "direct" || evidenceTier === "indirect";
  const hasBadges = showVisa || showRemote || showRestricted || showEvidenceTier;

  return (
    <div className="group relative h-full">
      {/* 북마크는 카드 링크의 형제로 절대배치 — a 안에 button 중첩(무효 HTML)과 네비 충돌 방지. */}
      {showSave && (
        <div className="absolute right-2.5 top-2.5 z-10">
          <SaveHeartButton jobId={job.id} loggedIn={loggedIn} />
        </div>
      )}
      <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="block h-full">
        <Card className="flex h-full flex-col rounded-lg p-5 transition-colors hover:border-primary/40">
        {/* 헤더: 로고 + 제목/회사·지역 + (마감 임박) */}
        <div className={`flex items-start gap-3 ${showSave ? "pr-8" : ""}`}>
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />
          <div className="min-w-0 flex-1">
            {/* 제목은 2줄 높이를 고정 — 1줄/2줄 제목이 섞여도 아래 회사·배지·태그 줄이 카드 간 정렬되게.
                영어 원제는 카드에서 반복하지 않는다(공간 낭비·어수선함) — title 툴팁과 상세 페이지가 담당. */}
            <h3
              title={job.title_ko ? job.title : undefined}
              className="line-clamp-2 min-h-[2.6rem] text-body font-semibold leading-snug transition-colors group-hover:text-primary"
            >
              {job.title_ko ?? job.title}
            </h3>
            <p className="mt-1 flex min-w-0 items-center gap-1 text-body-sm text-muted-foreground">
              {/* 회사명은 자르지 않는다(가장 중요한 메타) — 대신 덜 중요한 위치가 truncate. */}
              <span className="shrink-0">{job.company.display_name}</span>
              {locText && (
                <>
                  <span aria-hidden="true">·</span>
                  {flag && (
                    <span aria-hidden="true" className="shrink-0">
                      {flag}
                    </span>
                  )}
                  <span className="truncate" title={locText}>{locText}</span>
                </>
              )}
            </p>
          </div>
          {typeof matchScore === "number" && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-semibold text-primary">
              매칭 {matchScore}점
            </span>
          )}
          {deadline.urgent && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-caption font-medium text-warning"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 14%, transparent)" }}
            >
              마감 임박
            </span>
          )}
        </div>

        {/* 추천 사유 칩 (맞춤 추천 맥락 opt-in) */}
        {matchReasons && matchReasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {matchReasons.map((r) => (
              <span
                key={r}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* 신호 배지(비자·원격 — 명부검증 방패는 위 회사명 옆 인라인으로 분리) */}
        {hasBadges && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evidenceTier === "direct" && (
              <span
                title={TIER_NOTE.direct}
                className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary"
              >
                {TIER_LABEL.direct}
              </span>
            )}
            {evidenceTier === "indirect" && (
              <span
                title={TIER_NOTE.indirect}
                className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground"
              >
                {TIER_LABEL.indirect}
              </span>
            )}
            {showVisa && <VisaBadge status={job.visa?.status} remoteViable={showRemote} />}
            <RemoteBadge
              eligibility={job.remote?.eligibility}
              isRemote={job.is_remote}
              includeRestricted={showRestrictedRemote}
              location={job.location}
            />
          </div>
        )}

        {/* 기술 태그 */}
        {techTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {techTags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md bg-muted px-2 py-0.5 font-mono text-caption lowercase text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {techTags.length > 4 && (
              <span className="text-caption text-muted-foreground">+{techTags.length - 4}</span>
            )}
          </div>
        )}

        {/* 기술 태그가 없을 때: 레벨/고용형태 중립 칩으로 레이아웃 유지 */}
        {metaChip && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-muted px-2 py-0.5 text-caption text-muted-foreground">
              {metaChip}
            </span>
          </div>
        )}

        <div className="min-h-4 flex-1" aria-hidden="true" />

        {/* 푸터 — 슬롯 고정: 좌=연봉(없으면 회색 '연봉 미기재'), 우=실마감(D-N)+게시일.
            '상시채용'은 대다수 공고의 기본값이라 카드에선 생략 — 자리 이동으로 그리드 시선이 튀는 것 방지. */}
        <div className="flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            {salary ? (
              <>
                <div className="truncate text-body-sm font-semibold text-foreground">{salaryKrw ?? salary}</div>
                <div className="truncate text-caption text-muted-foreground">
                  {salaryKrw ? `${salary} · 연봉 추정` : "연봉 추정"}
                </div>
              </>
            ) : (
              <div className="text-caption text-muted-foreground">연봉 미기재</div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-caption text-muted-foreground">
            {deadline.text !== "상시채용" && <span className="whitespace-nowrap">{deadline.text}</span>}
            {posted && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {posted}
              </span>
            )}
          </div>
        </div>
      </Card>
      </Link>
    </div>
  );
}
