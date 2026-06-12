import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { ContactForm } from "@/components/home/ContactForm";
import { CountryTiles } from "@/components/home/CountryTiles";
import { CtaSection } from "@/components/home/CtaSection";
import { FaqSection } from "@/components/home/FaqSection";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { JobGrid } from "@/components/home/JobGrid";
import { MemberLandingRecommend } from "@/components/home/MemberLandingRecommend";
import { RecentJobs } from "@/components/home/RecentJobs";
import { SampleRecommend } from "@/components/home/SampleRecommend";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";
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
      <div className="mx-auto max-w-container px-4 py-14 sm:py-20">{children}</div>
    </section>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const [visaRes, allRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 4 }),
    fetchJobs({ pageSize: 1, includeUnclear: true }),
    fetchJobs({ pageSize: 4, sort: "newest" }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const visaTotal = visaRes.ok ? visaRes.data.total : 0;
  const allTotal = allRes.ok ? allRes.data.total : 0;
  const latestJobs = latestRes.ok ? latestRes.data.items : [];

  // 비로그인 홈의 "당신을 위한 6차원 매칭 공고" 예시 섹션용 (로그인 시엔 실제 추천을 부른다).
  // page:2 로 아래 "비자 스폰서십 공고"(page:1) 섹션과 공고가 겹치지 않게 한다.
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

  return (
    <>
      <Hero stats={stats} sponsorCompanies={sponsorChips} regions={regions} />

      {/* 맞춤 추천 미리보기 (연회색) */}
      {session ? (
        <Section muted>
          <MemberLandingRecommend />
        </Section>
      ) : (
        sampleJobs.length > 0 && (
          <Section muted>
            <SampleRecommend jobs={sampleJobs} />
          </Section>
        )
      )}

      {/* 비자 스폰서 명시 공고 (흰색) */}
      {visaJobs.length > 0 && (
        <Section>
          <SectionHeader
            overline="비자 스폰서십"
            title="비자 스폰서 명시 공고"
            count={visaTotal}
            href="/search?visa=sponsors"
            subtitle="공고 원문에서 비자 스폰서십이 명시적으로 확인된 공고만 모았어요."
          />
          <JobGrid jobs={visaJobs} hideVisaBadge />
        </Section>
      )}

      {/* 방금 올라온 공고 (연회색) */}
      {latestJobs.length > 0 && (
        <Section muted>
          <SectionHeader
            overline="최신"
            title="방금 올라온 공고"
            href="/search?sort=newest"
            subtitle="최근 등록된 해외 테크 공고를 모았어요."
          />
          <JobGrid jobs={latestJobs} />
        </Section>
      )}

      {/* 진출 가능한 국가 (흰색) */}
      {countryRegions.length > 0 && (
        <Section>
          <SectionHeader
            overline="국가별"
            title="진출 가능한 국가"
            count={countryRegions.length}
            href={countryRegions.length > 10 ? "/regions" : undefined}
            subtitle="비자 스폰서십 명시 공고가 있는 국가만 모았어요."
          />
          <CountryTiles regions={countryRegions} limit={10} />
        </Section>
      )}

      {/* 검증된 회사들 (연회색) */}
      {spotlight.length > 0 && (
        <Section muted>
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

      {/* FAQ (흰색) */}
      <Section id="faq">
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
