import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { MatchScorePanel } from "@/components/job/MatchScorePanel";
import { ResumeOptimizeSection } from "@/components/job/ResumeOptimizeSection";
import { SaveJobButton } from "@/components/job/SaveJobButton";
import { ShareButton } from "@/components/job/ShareButton";
import type { JobDetail } from "@/lib/types";

export function JobSidebar({ job, loggedIn, companyJobCount }: {
  job: JobDetail; loggedIn: boolean; companyJobCount?: number;
}) {
  return (
    <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <MatchScorePanel jobId={job.id} />

      <div className="rounded-2xl border border-border bg-surface p-4">
        {job.apply_url ? (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary px-6 text-body-sm font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            지원하기 <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <div aria-disabled="true" className="flex h-11 w-full items-center justify-center rounded-[10px] bg-surface-2 px-6 text-body-sm font-semibold text-muted-foreground">
            지원 링크 미제공
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <SaveJobButton jobId={job.id} loggedIn={loggedIn} />
          <ShareButton />
        </div>
      </div>

      <Link
        href={`/companies/${job.company.slug}`}
        className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2.5">
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={32} />
          <div className="min-w-0">
            <div className="truncate text-body-sm font-bold">{job.company.display_name}</div>
            {companyJobCount !== undefined && companyJobCount > 1 && (
              <div className="text-caption text-muted-foreground">전체 공고 {companyJobCount}개</div>
            )}
          </div>
        </div>
        <span className="mt-2 inline-block text-caption text-primary">회사 페이지 보기 →</span>
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <ResumeOptimizeSection jobId={job.id} />
      </div>
    </div>
  );
}
