import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CountryTiles } from "@/components/home/CountryTiles";
import { Hero } from "@/components/home/Hero";
import { JobScrollRow } from "@/components/home/JobScrollRow";
import { NlRecommend } from "@/components/home/NlRecommend";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [visaRes, latestRes, companies] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 6 }),
    fetchCompanies(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];

  return (
    <div className="space-y-12">
      <Hero />

      <section>
        <SectionHeader title="나에게 맞는 공고" accent="recommend" href="/recommend" hrefLabel="정교한 추천 설정" />
        <NlRecommend />
      </section>

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" href="/search?visa=sponsors" />
          <JobScrollRow jobs={visaJobs} />
        </section>
      )}

      <section>
        <SectionHeader title="국가별로 찾기" />
        <CountryTiles />
      </section>

      {latestJobs.length > 0 && (
        <section>
          <SectionHeader title="새로 올라온 공고" href="/search" hrefLabel="더 보기" />
          <JobScrollRow jobs={latestJobs} />
        </section>
      )}

      {spotlight.length > 0 && (
        <section>
          <SectionHeader title="주목할 회사" href="/companies" hrefLabel="회사 디렉터리" />
          <CompanySpotlight companies={spotlight} />
        </section>
      )}
    </div>
  );
}
