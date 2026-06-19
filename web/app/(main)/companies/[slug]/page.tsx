import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyInfo } from "@/components/company/CompanyInfo";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RelatedCommunity } from "@/components/community/RelatedCommunity";
import { CompanyStats } from "@/components/company/CompanyStats";
import { FavoriteCompanyButton } from "@/components/company/FavoriteCompanyButton";
import { JobCard } from "@/components/job/JobCard";
import { RegisterVerifiedBadge } from "@/components/job/RegisterVerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { fetchCompany } from "@/lib/api";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export default async function CompanyDetailPage({ params }: { params: { slug: string } }) {
  const [data, session] = await Promise.all([fetchCompany(params.slug), getSession()]);
  if (!data) notFound();

  const { company, jobs } = data;
  // 디렉터리의 verified 와 동일 의미(공고 중 하나라도 정부 명부 근거)를 프론트에서 도출한다.
  const registerVerified = jobs.some((j) => j.visa?.register_verified === true);

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
      <CompanyInfo slug={company.slug} />

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} showRestrictedRemote />
            ))}
          </div>
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
