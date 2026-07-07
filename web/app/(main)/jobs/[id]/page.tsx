import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BackButton } from "@/components/BackButton";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { InterviewPrepSection } from "@/components/job/InterviewPrepSection";
import { VisaGuideSection } from "@/components/job/VisaGuideSection";
import { OtherJobsCarousel } from "@/components/job/OtherJobsCarousel";
import { JobDescription } from "@/components/job/JobDescription";
import { JobFactCards } from "@/components/job/JobFactCards";
import { JobSidebar } from "@/components/job/JobSidebar";
import { JobSummary } from "@/components/job/JobSummary";
import { MobileApplyBar } from "@/components/job/MobileApplyBar";
import { NoTechStackNote } from "@/components/job/NoTechStackNote";
import { RecordJobView } from "@/components/job/RecordJobView";
import { RecordRecentJob } from "@/components/job/RecordRecentJob";
import { TechStackMatch } from "@/components/job/TechStackMatch";
import {
  fetchCachedSummary,
  fetchCompany,
  fetchInterviewPrep,
  fetchJob,
  fetchVisaGuide,
} from "@/lib/api";
import { getSession } from "@/lib/session-server";
import { filterTechTags } from "@/lib/techTags";

export const dynamic = "force-dynamic";

// fetchJob 은 no-store 라 generateMetadata + 본문에서 두 번 때리지 않도록 요청 단위 dedupe.
const getJob = cache((id: string) => fetchJob(id));

// 공유·검색 유입용 페이지별 메타 — "직함 — 회사 | DevPass".
export async function generateMetadata({ params }: { params: { id: string } }) {
  const result = await getJob(params.id);
  if (!result.ok) return {};
  const job = result.data;
  const title = `${job.title_ko ?? job.title} — ${job.company.display_name} | DevPass`;
  const description = `${job.company.display_name}의 ${job.title_ko ?? job.title} 채용 공고. 비자 스폰서십 여부와 연봉·기술 스택을 확인하세요.`;
  return { title, description, openGraph: { title, description } };
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [result, prep, visaGuide, session, initialSummary] = await Promise.all([
    getJob(params.id),
    fetchInterviewPrep(params.id),
    fetchVisaGuide(params.id),
    getSession(),
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
  const otherJobs = (companyData?.jobs ?? []).filter((j) => j.id !== job.id).slice(0, 12);
  const techTags = filterTechTags(job.tags, job.company);

  return (
    <>
      {/* 모바일 하단 고정바(≈68px)+safe-area 만큼 본문 하단 보정 — 정적 pb-24 는 노치 기기에서 겹쳤다. */}
      <div className="mx-auto max-w-6xl pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <RecordRecentJob
          id={job.id}
          title={job.title_ko ?? job.title}
          company={job.company.display_name}
          slug={job.company.slug}
        />
        <RecordJobView jobId={job.id} />

        <div className="mb-4">
          <BackButton fallbackHref="/search" label="공고 목록으로" />
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
          <article className="min-w-0 space-y-5">
            {/* 헤더 카드: 회사 → 제목 → '한눈에' 칩 → 비자 근거 한 줄 */}
            <header className="space-y-4 rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-start gap-4">
                <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={48} />
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/companies/${job.company.slug}`}
                    className="rounded-md text-body-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {job.company.display_name}
                  </Link>
                  <h1 className="text-h2 font-extrabold leading-tight tracking-tight">{job.title_ko ?? job.title}</h1>
                  {job.title_ko && <p className="text-body-sm text-muted-foreground">{job.title}</p>}
                </div>
              </div>

              <JobFactCards job={job} />
            </header>

            {job.description && <JobSummary jobId={job.id} initialData={initialSummary} />}
            {job.description && <JobDescription original={job.description} />}
            {techTags.length > 0 ? <TechStackMatch tags={techTags} /> : <NoTechStackNote />}
            {visaGuide && <VisaGuideSection guide={visaGuide} />}
            {prep && <InterviewPrepSection prep={prep} />}

            {otherJobs.length > 0 && (
              <OtherJobsCarousel
                title={`${job.company.display_name}의 다른 공고`}
                jobs={otherJobs}
              />
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
