import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CountryTiles } from "@/components/home/CountryTiles";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { TrackPicker } from "@/components/home/TrackPicker";
import { JobScrollRow } from "@/components/home/JobScrollRow";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [visaRes, allRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 1, includeUnclear: true }),
    fetchJobs({ pageSize: 6, sort: "newest" }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const visaTotal = visaRes.ok ? visaRes.data.total : 0;
  const allTotal = allRes.ok ? allRes.data.total : 0;
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];

  // 원격은 근무형태지 국가가 아니므로 "국가" 수치에서 제외. 공고가 있는 국가만 카운트.
  const countryRegions = regions.filter((r) => r.value !== "remote" && r.count > 0);

  const stats: HomeStats = {
    sponsors: visaTotal,
    total: allTotal,
    companies: companies?.total ?? 0,
    countries: countryRegions.length,
  };

  return (
    <div className="space-y-12">
      <Hero stats={stats} />

      <section>
        <h2 className="mb-3 text-center text-body-sm font-medium text-muted-foreground">
          어떤 길을 찾고 계세요?
        </h2>
        <TrackPicker />
      </section>

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" count={visaTotal} href="/search?visa=sponsors" />
          <JobScrollRow jobs={visaJobs} />
        </section>
      )}

      {countryRegions.length > 0 && (
        <section>
          <SectionHeader title="국가별로 찾기" />
          <CountryTiles regions={countryRegions} />
        </section>
      )}

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
