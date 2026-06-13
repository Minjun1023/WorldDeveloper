import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { ContactForm } from "@/components/home/ContactForm";
import { CountryTiles } from "@/components/home/CountryTiles";
import { CtaSection } from "@/components/home/CtaSection";
import { FaqSection } from "@/components/home/FaqSection";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { MemberLandingRecommend } from "@/components/home/MemberLandingRecommend";
import { SampleRecommend } from "@/components/home/SampleRecommend";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SponsorJobCard } from "@/components/home/SponsorJobCard";
import { VerifyMethodology } from "@/components/home/VerifyMethodology";
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";
import { getSession } from "@/lib/session-server";
import type { RecommendationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 히어로 우측 "6차원 매칭 미리보기" 카드용 예시 점수(개인화 아님 · 일러스트).
const HERO_PREVIEW_SCORE = {
  final_score: 0.94, stack: 0.92, visa: 1, location: 0.88, seniority: 0.9, salary: 0.8, semantic: 0.86,
  penalty_applied: 0, reasons: [], deal_breakers: [],
};

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
      <div className="mx-auto max-w-container px-4 py-14 sm:py-20">{children}</div>
    </section>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const [sponsorRes, allRes, companies, regions] = await Promise.all([
    // 최신 비자 스폰서십 공고(근거 문장 포함) + 통계(스폰서 총수) + 히어로 미리보기 공고에 함께 사용.
    fetchJobs({ visa: "sponsors", pageSize: 6, sort: "newest" }),
    fetchJobs({ pageSize: 1, includeUnclear: true }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const sponsorJobs = sponsorRes.ok ? sponsorRes.data.items : [];
  const visaTotal = sponsorRes.ok ? sponsorRes.data.total : 0;
  const allTotal = allRes.ok ? allRes.data.total : 0;

  // 비로그인 홈의 "당신을 위한 6차원 매칭 공고" 예시 섹션용(로그인 시엔 실제 추천을 부른다).
  // page:2 로 위 최신 공고(page:1)와 겹치지 않게 한다.
  const sampleRes = session
    ? null
    : await fetchJobs({ visa: "sponsors", pageSize: 6, page: 2, sort: "newest" });
  const sampleJobs = sampleRes?.ok ? sampleRes.data.items : [];

  const spotlight = companies?.items.slice(0, 8) ?? []; // 4열 × 2줄
  const sponsorChips = companies?.items.slice(0, 5) ?? []; // 히어로 신뢰 칩: 검증 회사 상위 5개

  // 원격은 근무형태지 국가가 아니므로 "국가" 수치에서 제외. 공고가 있는 국가만 카운트.
  const countryRegions = regions.filter((r) => r.value !== "remote" && r.count > 0);

  const stats: HomeStats = {
    sponsors: visaTotal,
    total: allTotal,
    companies: companies?.total ?? 0,
    countries: countryRegions.length,
  };

  const previewItem = sponsorJobs[0]
    ? ({ job: sponsorJobs[0], score: HERO_PREVIEW_SCORE } as unknown as RecommendationItem)
    : null;

  return (
    <>
      <div className="border-b border-border">
        <Hero stats={stats} sponsorCompanies={sponsorChips} regions={regions} previewItem={previewItem} />
      </div>

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

      {/* 진출 가능한 국가 (연회색) */}
      {countryRegions.length > 0 && (
        <Section muted>
          <SectionHeader
            overline="국가별"
            title="진출 가능한 국가"
            count={countryRegions.length}
            href={countryRegions.length > 10 ? "/regions" : undefined}
            subtitle="비자 스폰서십이 명시된 공고가 있는 국가만 모았어요."
          />
          <CountryTiles regions={countryRegions} limit={10} />
        </Section>
      )}

      {/* 검증된 회사들 (흰색) */}
      {spotlight.length > 0 && (
        <Section>
          <SectionHeader
            overline="회사 스포트라이트"
            title="검증된 회사들"
            href="/companies"
            hrefLabel="모든 회사 보기"
            subtitle="정부 명부 검증을 통과한 해외 테크 회사들이에요."
          />
          <CompanySpotlight companies={spotlight} />
        </Section>
      )}

      {/* 방금 올라온 비자 스폰서십 공고 — 근거 원문 문장 포함 (연회색) */}
      {sponsorJobs.length > 0 && (
        <Section muted>
          <SectionHeader
            overline="최신 공고"
            title="방금 올라온 비자 스폰서십 공고"
            href="/search?visa=sponsors&sort=newest"
            hrefLabel="전체 공고 보기"
            subtitle="스폰서십이 명시된 원문 문장을 근거로 함께 보여드려요."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {sponsorJobs.map((job) => (
              <SponsorJobCard key={job.id} job={job} />
            ))}
          </div>
        </Section>
      )}

      {/* 방법론: 어떻게 검증을 신뢰할 수 있나요? (흰색) */}
      <Section id="methodology">
        <SectionHeader
          overline="방법론"
          title="어떻게 ‘검증’을 신뢰할 수 있나요?"
          subtitle="정부 공식 명부와 채용 공고 원문을 교차 검증해요. 임의 분류 없이 출처와 근거를 함께 보여드려요."
        />
        <VerifyMethodology />
      </Section>

      {/* FAQ (연회색) */}
      <Section muted id="faq">
        <div className="mb-8 text-center">
          <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-primary">
            FAQ
          </div>
          <h2 className="text-h1">자주 묻는 질문</h2>
          <p className="mx-auto mt-2 max-w-xl text-body-sm text-muted-foreground">
            비자 분류 기준과 6차원 점수에 대한 궁금증을 풀어드려요.
          </p>
        </div>
        <FaqSection />
      </Section>

      {/* CTA (흰색 위 그라데이션 배너) */}
      <Section>
        <CtaSection loggedIn={!!session} />
      </Section>

      {/* 문의 (맨 밑, 푸터 직전) */}
      <Section muted id="contact">
        <div className="mx-auto max-w-xl">
          <SectionHeader
            overline="문의"
            title="궁금한 점이 있으신가요?"
            subtitle="제품·공고·제휴 관련 문의를 남겨주세요. 메일로 회신드려요."
          />
          <ContactForm />
        </div>
      </Section>
    </>
  );
}
