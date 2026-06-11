import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SaveJobButton } from "@/components/job/SaveJobButton";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import { formatSalary } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { guideForLocation } from "@/lib/visa-guide";

const VISA_LABEL: Record<string, { text: string; cls: string }> = {
  sponsors: { text: "지원 가능", cls: "text-success" },
  no_sponsor: { text: "스폰서 불가", cls: "text-destructive" },
};

const EMP_LABEL: Record<string, string> = {
  FULLTIME: "정규직",
  PARTTIME: "파트타임",
  CONTRACTOR: "계약직",
  TEMPORARY: "임시직",
  INTERN: "인턴",
};

// 경력 표기: 0=신입, n>0="n년+". seniority 와 합쳐 "Senior · 5년+".
function experienceText(years?: number | null, seniority?: string | null): string | null {
  const exp = years == null ? null : years === 0 ? "신입" : `${years}년+`;
  return [seniority, exp].filter(Boolean).join(" · ") || null;
}

// 상세 우측 sticky 카드: 지원/저장 + 핵심 메타 + 회사 미니카드.
export function JobActionCard({ job, loggedIn, companyJobCount }: {
  job: JobDetail; loggedIn: boolean; companyJobCount?: number;
}) {
  const salary = formatSalary(job.salary);
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const visa = job.visa?.status ? VISA_LABEL[job.visa.status] : undefined;
  const guide = guideForLocation(job.location);

  const rows: { label: string; value: ReactNode }[] = [];
  if (visa) {
    rows.push({ label: "비자", value: <span className={`font-semibold ${visa.cls}`}>{visa.text}{job.visa?.register_verified ? " · 명부검증" : ""}</span> });
  } else if (job.visa?.register_verified) {
    rows.push({ label: "비자", value: <span className="font-semibold text-success">명부검증 스폰서</span> });
  }
  rows.push({ label: "위치", value: <span className="font-semibold">{[job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ") || "미표기"}</span> });
  const exp = experienceText(job.experience_years, job.seniority);
  if (exp) rows.push({ label: "경력", value: <span className="font-semibold">{exp}</span> });
  const emp = job.employment_type ? EMP_LABEL[job.employment_type] : undefined;
  if (emp) rows.push({ label: "근무형태", value: <span className="font-semibold">{emp}</span> });
  if (salary) rows.push({ label: "연봉", value: <span className="font-semibold">{salary}</span> });
  if (posted) rows.push({ label: "게시", value: <span className="font-semibold">{posted}</span> });
  rows.push({ label: "마감", value: <span className={deadline.urgent ? "font-semibold text-warning" : "font-semibold"}>{deadline.text}</span> });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="space-y-2">
        {job.apply_url ? (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary text-body-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            지원하기 <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <div
            aria-disabled="true"
            className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-surface-2 text-body-sm font-semibold text-muted-foreground"
          >
            지원 링크 미제공
          </div>
        )}
        <SaveJobButton jobId={job.id} loggedIn={loggedIn} className="w-full" />
      </div>

      <dl className="space-y-2.5 border-t border-border pt-4 text-body-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right">{r.value}</dd>
          </div>
        ))}
      </dl>

      <Link href={`/companies/${job.company.slug}`}
        className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={36} />
        <div className="min-w-0">
          <div className="truncate text-body-sm font-bold">{job.company.display_name}</div>
          {companyJobCount !== undefined && companyJobCount > 1 && (
            <div className="text-caption text-muted-foreground">공고 {companyJobCount}개 보기</div>
          )}
        </div>
      </Link>

      {guide && (
        <Link
          href={`/visa/${guide.slug}`}
          className="block rounded-xl border border-border p-3 text-body-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">{guide.flag}</span>{" "}
          <span className="font-semibold text-foreground">{guide.country} 비자 가이드</span>
          <span className="text-muted-foreground"> · {guide.visaName} 안내 →</span>
        </Link>
      )}
    </div>
  );
}
