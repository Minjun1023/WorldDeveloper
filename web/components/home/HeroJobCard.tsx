import { CompanyLogo } from "@/components/company/CompanyLogo";
import { formatSalary } from "@/lib/salary";
import { filterTechTags } from "@/lib/techTags";
import type { Job } from "@/lib/types";

// 히어로 우측 시각물 — 실제 활성 공고 1건으로 "5축 매칭"을 보여주는 카드.
// 공고(제목·회사·지역·스택·연봉·검증 배지)는 실데이터. 매칭 점수는 개인화 값이라 비로그인엔 실점수가
// 없으므로 "예시"로 표기한다(로그인 후 추천/공고 상세에서 내 실제 점수 확인).
const SAMPLE_BARS: { label: string; v: number }[] = [
  { label: "스택", v: 94 },
  { label: "지역", v: 88 },
  { label: "레벨", v: 90 },
  { label: "연봉", v: 82 },
  { label: "의미", v: 91 },
];

export function HeroJobCard({ job }: { job?: Job | null }) {
  const title = job ? job.title_ko || job.title : "Senior Backend Engineer";
  const companyName = job?.company.display_name ?? "Stripe";
  const location = job ? job.location_ko || job.location || "원격" : "Dublin, Ireland";
  const verifiedBadge = job?.visa?.register_verified
    ? "비자 검증"
    : job?.visa?.status === "sponsors"
      ? "비자 스폰서"
      : job
        ? null
        : "비자 검증";

  const salary = job ? formatSalary(job.salary) : "$180k–$240k";
  const techTags = job ? filterTechTags(job.tags, job.company).slice(0, 3) : ["go", "postgres", "kubernetes"];
  const chips = [...techTags, ...(salary ? [salary] : [])];

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg">
      {/* 헤더: 회사 로고 + 직무 + 검증 배지 */}
      <div className="flex items-start gap-3">
        {job ? (
          <CompanyLogo slug={job.company.slug} name={companyName} size={48} />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-2 text-h3 font-bold text-muted-foreground">
            S
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-h3 font-bold leading-tight text-foreground">{title}</h3>
          <p className="mt-0.5 truncate text-body-sm text-muted-foreground">
            {companyName} · {location}
          </p>
        </div>
        {verifiedBadge && (
          <span className="shrink-0 rounded-full bg-primary-tint px-2.5 py-1 text-caption font-semibold text-primary">
            {verifiedBadge}
          </span>
        )}
      </div>

      {/* 매칭 점수 (예시 — 개인화 값) */}
      <div className="mt-6 flex items-end justify-between">
        <span className="flex items-center gap-1.5 text-body-sm font-medium text-muted-foreground">
          매칭 점수
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-hint">
            예시
          </span>
        </span>
        <span className="text-[2rem] font-extrabold leading-none text-foreground">
          92<span className="text-body-sm font-semibold text-muted-foreground">/100</span>
        </span>
      </div>

      {/* 5축 바 */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        {SAMPLE_BARS.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-caption">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="font-bold tabular-nums text-foreground">{b.v}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${b.v}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 스택·연봉 칩 */}
      {chips.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-2 px-3 py-1 text-caption font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
