import Link from "next/link";

import { ApplyButton } from "@/components/job/ApplyButton";
import { buttonVariants } from "@/components/ui/button";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RelatedCommunity } from "@/components/community/RelatedCommunity";
import { MatchScorePanel } from "@/components/job/MatchScorePanel";
import { SaveJobButton } from "@/components/job/SaveJobButton";
import { ShareButton } from "@/components/job/ShareButton";
import { COMPANY_FACTS } from "@/lib/company-facts";
import { headquartersLabel, industryLabel } from "@/lib/company-facts-format";
import { companyProfile } from "@/lib/company-profiles";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export function JobSidebar({ job, loggedIn, companyJobCount }: {
  job: JobDetail; loggedIn: boolean; companyJobCount?: number;
}) {
  // 회사 mini-card 보강용 — 우리가 가진 사실(Wikidata) + 수기 소개.
  const facts = COMPANY_FACTS[job.company.slug];
  const profile = companyProfile(job.company.slug);
  const industry = facts?.industry ? industryLabel(facts.industry) : null;
  const hq = headquartersLabel(facts?.hq, facts?.country, profile?.location);
  const companyMeta = [industry, hq].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <MatchScorePanel jobId={job.id} loggedIn={loggedIn} />

      <div className="rounded-2xl border border-border bg-surface p-4">
        <ApplyButton
          jobId={job.id}
          applyUrl={job.apply_url}
          loggedIn={loggedIn}
          className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}
          disabledClassName="flex h-11 w-full items-center justify-center rounded-lg bg-surface-2 px-6 text-body-sm font-semibold text-muted-foreground"
        />
        <div className="mt-2 flex gap-2">
          <SaveJobButton jobId={job.id} loggedIn={loggedIn} />
          <ShareButton />
        </div>
      </div>

      <Link
        href={`/companies/${job.company.slug}`}
        className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-2.5">
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body-sm font-bold">{job.company.display_name}</div>
            {companyMeta && (
              <div className="truncate text-caption text-muted-foreground">{companyMeta}</div>
            )}
          </div>
        </div>
        {profile?.description && (
          <p className="mt-2.5 line-clamp-2 text-body-sm leading-snug text-muted-foreground">
            {profile.description}
          </p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {companyJobCount !== undefined && companyJobCount > 1 ? (
            <span className="text-caption text-muted-foreground">전체 공고 {companyJobCount}개</span>
          ) : (
            <span />
          )}
          <span className="text-caption font-medium text-primary">더보기</span>
        </div>
      </Link>

      {/* 라운지 역노출 — 이 회사/공고 관련 글 (우측 레일) */}
      <RelatedCommunity
        filter={{ company: job.company.slug }}
        writeParams={{ jobId: job.id, company: job.company.slug, category: "interview" }}
        title="이 회사 관련 라운지 글"
        writeLabel="글쓰기"
      />
    </div>
  );
}
