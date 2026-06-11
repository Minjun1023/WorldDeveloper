import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SaveJobButton } from "@/components/job/SaveJobButton";
import { deadlineLabel, postedRelativeLabel } from "@/lib/jobDates";
import type { JobDetail } from "@/lib/types";

function salaryText(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)} – ${k(max)}`;
  return k((min ?? max)!);
}

const VISA_LABEL: Record<string, { text: string; cls: string }> = {
  sponsors: { text: "지원 가능", cls: "text-success" },
  no_sponsor: { text: "스폰서 불가", cls: "text-destructive" },
};

// 상세 우측 sticky 카드: 지원/저장 + 핵심 메타 + 회사 미니카드.
export function JobActionCard({ job, loggedIn, companyJobCount }: {
  job: JobDetail; loggedIn: boolean; companyJobCount?: number;
}) {
  const salary = salaryText(job.salary?.min_usd, job.salary?.max_usd);
  const posted = postedRelativeLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const visa = job.visa?.status ? VISA_LABEL[job.visa.status] : undefined;

  const rows: { label: string; value: ReactNode }[] = [];
  if (visa) {
    rows.push({ label: "비자", value: <span className={`font-semibold ${visa.cls}`}>{visa.text}{job.visa?.register_verified ? " · 명부검증" : ""}</span> });
  } else if (job.visa?.register_verified) {
    rows.push({ label: "비자", value: <span className="font-semibold text-success">명부검증 스폰서</span> });
  }
  rows.push({ label: "위치", value: <span className="font-semibold">{[job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ") || "미표기"}</span> });
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
    </div>
  );
}
