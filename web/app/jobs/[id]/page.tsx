import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { JobDescription } from "@/components/job/JobDescription";
import { JobSummary } from "@/components/job/JobSummary";
import { ResumeOptimizeSection } from "@/components/job/ResumeOptimizeSection";
import { VisaBadge } from "@/components/job/VisaBadge";
import { RemoteBadge } from "@/components/job/RemoteBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchInterviewPrep, fetchJob } from "@/lib/api";
import { postedLabel, deadlineLabel } from "@/lib/jobDates";

export const dynamic = "force-dynamic";

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  return k((min ?? max)!);
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [result, prep] = await Promise.all([
    fetchJob(params.id),
    fetchInterviewPrep(params.id),
  ]);

  if (!result.ok && result.status === 404) {
    notFound();
  }
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
        공고를 불러오지 못했습니다 ({result.error}).
        <div className="mt-3">
          <Link href="/search" className="text-primary hover:underline">
            ← 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const job = result.data;
  const salary = formatSalary(job.salary?.min_usd, job.salary?.max_usd);
  const posted = postedLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const metaParts = [job.company.display_name, job.location, job.is_remote ? "Remote" : null].filter(
    Boolean,
  );

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/search" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
        ← 목록으로
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={48} />
            <h1 className="text-h1">{job.title}</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <VisaBadge status={job.visa?.status} />
            <RemoteBadge eligibility={job.remote?.eligibility} />
          </div>
        </div>
        <p className="text-muted-foreground">{metaParts.join(" · ")}</p>

        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((t) => (
              <Badge key={t} variant="outline" className="font-mono lowercase">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted}</span>}
          <span className={deadline.urgent ? "text-foreground font-medium" : undefined}>
            {deadline.text}
          </span>
        </div>
      </header>

      {job.description && <JobSummary jobId={job.id} />}

      {job.description && (
        <JobDescription jobId={job.id} original={job.description} />
      )}

      {prep && <InterviewPrepSection prep={prep} />}

      <ResumeOptimizeSection jobId={job.id} />

      <div className="pt-2">
        <a href={job.apply_url ?? "#"} target="_blank" rel="noopener noreferrer">
          <Button>지원 페이지로 이동 →</Button>
        </a>
      </div>
    </article>
  );
}
