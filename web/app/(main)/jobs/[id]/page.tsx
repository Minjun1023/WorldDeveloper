import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { JobActionCard } from "@/components/job/JobActionCard";
import { JobCard } from "@/components/job/JobCard";
import { JobDescription } from "@/components/job/JobDescription";
import { JobSummary } from "@/components/job/JobSummary";
import { MobileApplyBar } from "@/components/job/MobileApplyBar";
import { RecordRecentJob } from "@/components/job/RecordRecentJob";
import { ResumeOptimizeSection } from "@/components/job/ResumeOptimizeSection";
import { Badge } from "@/components/ui/badge";
import { fetchCachedTranslation, fetchCompany, fetchInterviewPrep, fetchJob } from "@/lib/api";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [result, prep, session, initialKo] = await Promise.all([
    fetchJob(params.id),
    fetchInterviewPrep(params.id),
    getSession(),
    fetchCachedTranslation(params.id, "ko"), // 캐시된 번역만(즉시표시), 미스면 null → 클라 번역
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
      <article className="mx-auto max-w-3xl space-y-6 pb-24 lg:pb-0">
        <RecordRecentJob
          id={job.id}
          title={job.title_ko ?? job.title}
          company={job.company.display_name}
          slug={job.company.slug}
        />
        <Link href="/search" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
          ← 목록으로
        </Link>

        <header className="space-y-4">
          {/* 회사 먼저(작게) → 큰 제목. 위치는 아래 정보바에 있어 헤더에서 중복 제거. */}
          <Link
            href={`/companies/${job.company.slug}`}
            className="inline-flex items-center gap-2 rounded-md text-body-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={28} />
            {job.company.display_name}
          </Link>

          <div className="space-y-1.5">
            <h1 className="text-display leading-tight">{job.title_ko ?? job.title}</h1>
            {job.title_ko && <p className="text-body text-muted-foreground">{job.title}</p>}
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

        {/* 상단 전폭 정보바 (우측 sticky 대체) */}
        <JobActionCard job={job} loggedIn={!!session} companyJobCount={companyData?.company.job_count} />

        {job.description && <JobSummary jobId={job.id} />}
        {job.description && <JobDescription jobId={job.id} original={job.description} initialKo={initialKo} />}
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
      </article>

      <MobileApplyBar jobId={job.id} applyUrl={job.apply_url} loggedIn={!!session} />
    </>
  );
}
