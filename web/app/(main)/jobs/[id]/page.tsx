import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { JobActionCard } from "@/components/job/JobActionCard";
import { JobCard } from "@/components/job/JobCard";
import { JobDescription } from "@/components/job/JobDescription";
import { JobSummary } from "@/components/job/JobSummary";
import { MobileApplyBar } from "@/components/job/MobileApplyBar";
import { ResumeOptimizeSection } from "@/components/job/ResumeOptimizeSection";
import { Badge } from "@/components/ui/badge";
import { fetchCompany, fetchInterviewPrep, fetchJob } from "@/lib/api";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [result, prep, session] = await Promise.all([
    fetchJob(params.id),
    fetchInterviewPrep(params.id),
    getSession(),
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
  const companyData = await fetchCompany(job.company.slug);
  const otherJobs = (companyData?.jobs ?? []).filter((j) => j.id !== job.id).slice(0, 3);

  return (
    <>
      <article className="mx-auto max-w-5xl">
        <Link href="/search" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
          ← 목록으로
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          {/* 좌: 본문 */}
          <div className="min-w-0 space-y-6 pb-24 lg:pb-0">
            <header className="space-y-3">
              <div className="flex items-start gap-3">
                <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={48} />
                <div className="min-w-0">
                  <h1 className="text-h1">{job.title}</h1>
                  <p className="mt-1 text-muted-foreground">
                    {[job.company.display_name, job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {job.tags && job.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.tags.map((t) => (
                    <Badge key={t} variant="outline" className="font-mono lowercase">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </header>

            {/* 모바일: 본문 위 액션/메타 카드 (데스크톱은 우측 sticky 가 담당) */}
            <div className="lg:hidden">
              <JobActionCard job={job} loggedIn={!!session} companyJobCount={companyData?.company.job_count} />
            </div>

            {job.description && <JobSummary jobId={job.id} />}
            {job.description && <JobDescription jobId={job.id} original={job.description} />}
            {prep && <InterviewPrepSection prep={prep} />}
            <ResumeOptimizeSection jobId={job.id} />

            {otherJobs.length > 0 && (
              <section className="space-y-3 border-t border-border pt-6">
                <h2 className="text-h3">{job.company.display_name}의 다른 공고</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {otherJobs.map((j) => (
                    <JobCard key={j.id} job={j} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 우: sticky 액션 카드 (lg 이상) */}
          <aside className="hidden lg:block lg:sticky lg:top-24">
            <JobActionCard job={job} loggedIn={!!session} companyJobCount={companyData?.company.job_count} />
          </aside>
        </div>
      </article>

      <MobileApplyBar jobId={job.id} applyUrl={job.apply_url} loggedIn={!!session} />
    </>
  );
}
