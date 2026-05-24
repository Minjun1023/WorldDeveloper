import Link from "next/link";
import { notFound } from "next/navigation";

import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { JobDescription } from "@/components/job/JobDescription";
import { ResumeOptimizeSection } from "@/components/job/ResumeOptimizeSection";
import { VisaBadge } from "@/components/job/VisaBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchInterviewPrep, fetchJob } from "@/lib/api";

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
          <Link href="/" className="text-primary hover:underline">
            ← 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const job = result.data;
  const salary = formatSalary(job.salary?.min_usd, job.salary?.max_usd);
  const posted = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString("ko-KR")
    : null;
  const closes = job.closes_at ? new Date(job.closes_at) : null;
  const daysLeft = closes
    ? Math.ceil((closes.getTime() - Date.now()) / 86_400_000)
    : null;
  const metaParts = [job.company.display_name, job.location, job.is_remote ? "Remote" : null].filter(
    Boolean,
  );

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
        ← 목록으로
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-h1">{job.title}</h1>
          <VisaBadge status={job.visa?.status} />
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
          {posted && <span>{posted} 게시</span>}
          {closes && daysLeft !== null && (
            <span className={daysLeft <= 7 ? "text-foreground font-medium" : undefined}>
              마감 {closes.toLocaleDateString("ko-KR")}
              {daysLeft >= 0 ? ` (D-${daysLeft})` : " (마감)"}
            </span>
          )}
          <span className="font-mono">{job.id}</span>
        </div>
      </header>

      {job.visa?.evidence && job.visa.evidence.length > 0 && (
        <section className="rounded-lg border border-border bg-surface-2 p-4">
          <h2 className="text-body-sm font-medium">비자 근거</h2>
          <ul className="mt-2 space-y-1 text-body-sm text-muted-foreground">
            {job.visa.evidence.map((e, i) => (
              <li key={i}>“{e}”</li>
            ))}
          </ul>
        </section>
      )}

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
