import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyInfo } from "@/components/company/CompanyInfo";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RelatedCommunity } from "@/components/community/RelatedCommunity";
import { CompanyStats } from "@/components/company/CompanyStats";
import { FavoriteCompanyButton } from "@/components/company/FavoriteCompanyButton";
import { JobCard } from "@/components/job/JobCard";
import { RegisterVerifiedBadge } from "@/components/job/RegisterVerifiedBadge";
import { Pagination } from "@/components/search/Pagination";
import { Badge } from "@/components/ui/badge";
import { fetchCompany } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12; // 공고 12개(3열 × 4행) 단위로 페이지네이션

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [data, session] = await Promise.all([fetchCompany(params.slug), getSession()]);
  if (!data) notFound();

  const { company, jobs } = data;
  // 디렉터리의 verified 와 동일 의미(공고 중 하나라도 정부 명부 근거)를 프론트에서 도출한다.
  // 검증/통계는 전체 공고로 계산하고, 목록만 현재 페이지로 슬라이스한다.
  const registerVerified = jobs.some((j) => j.visa?.register_verified === true);

  // 백엔드가 전체 공고 배열을 주므로(페이지네이션 미지원) 서버에서 페이지 슬라이스.
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageJobs = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <Link href="/companies" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
        ← 회사 목록
      </Link>

      {/* 히어로 카드 */}
      <header className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <CompanyLogo slug={company.slug} name={company.display_name} size={64} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-h1">{company.display_name}</h1>
              {registerVerified && <RegisterVerifiedBadge />}
            </div>

            {company.website_url && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {cleanUrl(company.website_url)}
                </a>
              </div>
            )}

            {company.tags && company.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {company.tags.map((t) => (
                  <Link key={t} href={`/companies?tag=${encodeURIComponent(t)}`}>
                    <Badge variant="outline" className="hover:border-primary/40">
                      {t}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <FavoriteCompanyButton slug={company.slug} loggedIn={!!session} className="shrink-0" />
        </div>
      </header>

      {/* 회사 정보 (한 줄 소개 + Wikidata 보강 사실) */}
      <CompanyInfo
        slug={company.slug}
        tags={company.tags}
        location={COMPANY_LOCATIONS[company.slug]?.location}
      />

      {/* 통계 행 (공고 목록에서 계산) */}
      <CompanyStats jobs={jobs} jobCount={company.job_count} />

      {/* 이 회사의 공고 */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-h2">이 회사의 공고</h2>
          <span className="text-body-sm text-muted-foreground">{company.job_count}개</span>
        </div>
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
            현재 공고가 없습니다.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pageJobs.map((job) => (
                <JobCard key={job.id} job={job} showRestrictedRemote />
              ))}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={jobs.length} />
          </>
        )}
      </section>

      {/* 라운지 역노출 — 이 회사 관련 글 */}
      <RelatedCommunity
        filter={{ company: company.slug }}
        writeParams={{ company: company.slug, category: "company" }}
        title="이 회사 라운지 글"
        writeLabel="후기·질문 쓰기"
      />
    </div>
  );
}
