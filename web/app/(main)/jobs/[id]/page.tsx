import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { JobCard } from "@/components/job/JobCard";
import { JobDescription } from "@/components/job/JobDescription";
import { JobFactCards } from "@/components/job/JobFactCards";
import { JobSidebar } from "@/components/job/JobSidebar";
import { JobSummary } from "@/components/job/JobSummary";
import { MobileApplyBar } from "@/components/job/MobileApplyBar";
import { RecordRecentJob } from "@/components/job/RecordRecentJob";
import { TechStackMatch } from "@/components/job/TechStackMatch";
import { VisaEvidence } from "@/components/job/VisaEvidence";
import {
  fetchCachedSummary,
  fetchCachedTranslation,
  fetchCompany,
  fetchInterviewPrep,
  fetchJob,
} from "@/lib/api";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [result, prep, session, initialKo, initialSummary] = await Promise.all([
    fetchJob(params.id),
    fetchInterviewPrep(params.id),
    getSession(),
    fetchCachedTranslation(params.id, "ko"), // 캐시된 번역만(즉시표시), 미스면 null → 클라 번역
    fetchCachedSummary(params.id, "ko"), // 캐시된 요약만(즉시 펼침), 미스면 null → 클라 생성
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
  const otherJobs = (companyData?.jobs ?? []).filter((j) => j.id !== job.id).slice(0, 4);

  return (
    <>
      <div className="mx-auto max-w-6xl pb-24 lg:pb-0">
        <RecordRecentJob
          id={job.id}
          title={job.title_ko ?? job.title}
          company={job.company.display_name}
          slug={job.company.slug}
        />
        <Link
          href="/search"
          className="mb-4 inline-block text-body-sm text-muted-foreground hover:text-foreground"
        >
          ← 목록으로
        </Link>

        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
          <article className="min-w-0 space-y-6">
            <header className="space-y-4">
              {/* 회사 먼저(작게) → 큰 제목. 위치는 정보 카드에 있어 헤더에서 중복 제거. */}
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
            </header>

            <JobFactCards job={job} />
            <VisaEvidence visa={job.visa} />

            {job.description && <JobSummary jobId={job.id} initialData={initialSummary} />}
            {job.tags && job.tags.length > 0 && <TechStackMatch tags={job.tags} />}
            {job.description && (
              <JobDescription jobId={job.id} original={job.description} initialKo={initialKo} />
            )}
            {prep && <InterviewPrepSection prep={prep} />}

            {otherJobs.length > 0 && (
              <section className="space-y-3 border-t border-border pt-6">
                <h2 className="text-h3">{job.company.display_name}의 다른 공고</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {otherJobs.map((j) => (
                    <JobCard key={j.id} job={j} />
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="mt-6 lg:mt-0">
            <JobSidebar
              job={job}
              loggedIn={!!session}
              companyJobCount={companyData?.company.job_count}
            />
          </aside>
        </div>
      </div>

      <MobileApplyBar jobId={job.id} applyUrl={job.apply_url} loggedIn={!!session} />
    </>
  );
}
