import { CompanyMarquee } from "@/components/home/CompanyMarquee";
import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CtaSection } from "@/components/home/CtaSection";
import { FaqSection } from "@/components/home/FaqSection";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { MatchAxes } from "@/components/home/MatchAxes";
import { MemberLandingRecommend } from "@/components/home/MemberLandingRecommend";
import { PopularJobs } from "@/components/home/PopularJobs";
import { SampleRecommend } from "@/components/home/SampleRecommend";
import { SectionHeader } from "@/components/home/SectionHeader";
import { StatsBand } from "@/components/home/StatsBand";
import { JobRow } from "@/components/job/JobRow";
import { VerifyMethodology } from "@/components/home/VerifyMethodology";
import { fetchCompanies, fetchJobs, fetchPopularSearches, fetchRegions } from "@/lib/api";
import { getSession } from "@/lib/session-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 랜딩 전폭 섹션 래퍼: 교차 배경(흰색/연회색) + 안쪽 max-w 컨테이너.
function Section({
  children,
  muted = false,
  id,
}: {
  children: React.ReactNode;
  muted?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn(muted && "section-muted")}>
      <div className="mx-auto max-w-container px-4 py-12 sm:py-16">{children}</div>
    </section>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const [sponsorRes, verifiedRes, companies, regions, popularSearches] = await Promise.all([
    // 최신 비자 스폰서십 공고(근거 문장 포함) + 통계(스폰서·명부검증 총수) + 히어로 미리보기 공고에 함께 사용.
    fetchJobs({ visa: "sponsors", pageSize: 6, sort: "newest" }),
    fetchJobs({ verifiedOnly: true, pageSize: 1 }), // 정부 명부 검증 공고 총수(통계 띠)
    fetchCompanies(),
    fetchRegions(),
    fetchPopularSearches(8), // 인기 검색어(실측). 데이터 부족 시 Hero가 큐레이션 fallback.
  ]);

  const sponsorJobs = sponsorRes.ok ? sponsorRes.data.items : [];
  // 히어로 카드용 대표 공고 — 활성 비자 스폰서 공고 중 명부검증된 것 우선(없으면 최신 1건).
  const featuredJob = sponsorJobs.find((j) => j.visa?.register_verified) ?? sponsorJobs[0] ?? null;
  const visaTotal = sponsorRes.ok ? sponsorRes.data.total : 0;
  const verifiedTotal = verifiedRes.ok ? verifiedRes.data.total : 0;

  // 비로그인 홈의 "당신을 위한 5축 매칭 공고" 예시 섹션용(로그인 시엔 실제 추천을 부른다).
  // page:2 로 위 최신 공고(page:1)와 겹치지 않게 한다.
  const sampleRes = session
    ? null
    : await fetchJobs({ visa: "sponsors", pageSize: 6, page: 2, sort: "newest" });
  const sampleJobs = sampleRes?.ok ? sampleRes.data.items : [];

  // "검증된 회사들" 섹션은 헤더가 "정부 명부 검증을 통과한 회사"라고 단언하므로, 실제로 명부 검증
  // (verified=Home Office/USCIS 근거 보유)된 회사만 노출한다. 공고 수 상위라도 미검증(Anthropic 등)은 제외.
  const verifiedCompanies = (companies?.items ?? []).filter((c) => c.verified);
  const spotlight = verifiedCompanies.slice(0, 8); // 4열 × 2줄
  const marqueeCompanies = verifiedCompanies.slice(0, 16); // 통계 띠 아래 로고 마퀴

  // 원격은 근무형태지 국가가 아니므로 "국가" 수치에서 제외. 공고가 있는 국가만 카운트.
  const countryRegions = regions.filter((r) => r.value !== "remote" && r.count > 0);

  const stats: HomeStats = {
    sponsors: visaTotal,
    verified: verifiedTotal,
    companies: companies?.total ?? 0,
    countries: countryRegions.length,
  };

  return (
    <>
      <Hero regions={regions} popularSearches={popularSearches} featuredJob={featuredJob} />

      {/* 통계 띠 (히어로 직후 전폭) */}
      <StatsBand stats={stats} />

      {/* 디렉터리에 수록된 비자 스폰서 기업 — 로고 마퀴 */}
      <CompanyMarquee companies={marqueeCompanies} />

      {/* 맞춤 추천 미리보기 (흰색) */}
      {session ? (
        <Section>
          <MemberLandingRecommend />
        </Section>
      ) : (
        sampleJobs.length > 0 && (
          <Section>
            <SampleRecommend jobs={sampleJobs} />
          </Section>
        )
      )}

      {/* 인기 TOP 공고 (연회색) — 지역·직무 드롭다운별 인기(최근 7일 조회수) 정렬. 데이터 적으면 최신순 fallback. */}
      <Section muted>
        <SectionHeader
          title="인기 TOP 공고"
          href="/search?visa=sponsors&sort=newest"
          subtitle="지역·직무별로 지금 많이 보는 공고"
        />
        <PopularJobs loggedIn={!!session} />
      </Section>

      {/* 최신 공고 (흰색) */}
      {sponsorJobs.length > 0 && (
        <Section>
          <SectionHeader
            title="최신 공고"
            href="/search?visa=sponsors&sort=newest"
            hrefLabel="전체 공고 보기"
            subtitle="검증된 공고만 수록"
          />
          <div className="space-y-3">
            {sponsorJobs.map((job) => (
              <JobRow key={job.id} job={job} loggedIn={!!session} />
            ))}
          </div>
        </Section>
      )}

      {/* 방법론: 어떻게 검증하나요? (연회색) */}
      <Section muted id="methodology">
        <div className="mb-6 text-center">
          <h2 className="text-h2">어떻게 검증하나요?</h2>
          <p className="mx-auto mt-1.5 max-w-xl text-body-sm text-muted-foreground">
            3단계 교차검증 방법론
          </p>
        </div>
        <VerifyMethodology />
      </Section>

      {/* 검증된 기업들 (흰색) */}
      {spotlight.length > 0 && (
        <Section>
          <SectionHeader
            title="검증된 기업들"
            href="/companies"
            hrefLabel="모든 기업 보기"
            subtitle="정부 명부 검증을 통과한 해외 테크 기업들이에요."
          />
          <CompanySpotlight companies={spotlight} />
        </Section>
      )}

      {/* 5축 매칭 설명 (연회색) — 검증된 기업들과 FAQ 사이 */}
      <Section muted>
        <MatchAxes />
      </Section>

      {/* FAQ (흰색) */}
      <Section id="faq">
        <div className="mb-6 text-center">
          <h2 className="text-h2">자주 묻는 질문</h2>
        </div>
        <FaqSection />
      </Section>

      {/* CTA (흰색 위 그라데이션 배너) */}
      <Section>
        <CtaSection loggedIn={!!session} />
      </Section>
    </>
  );
}
