import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary } from "@/lib/types";

export function Hero({
  stats,
  sponsorCompanies,
  regions,
  loggedIn,
}: {
  stats: HomeStats;
  sponsorCompanies: CompanySummary[];
  regions: RegionCount[];
  loggedIn: boolean;
}) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <CredibilityPill />

      <h1 className="mt-4 text-display">
        한국 개발자를 위한{" "}
        <span className="font-serif text-verified">실제로 채용 가능한</span>{" "}
        <span className="text-primary">비자 스폰서</span> 공고
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        기술스택·지역으로 검색하거나, 조건을 문장으로 적어 AI 추천을 받아보세요.
      </p>

      <HeroSearch regions={regions} loggedIn={loggedIn} />

      <SponsorChips companies={sponsorCompanies} />

      <HeroStats stats={stats} />
    </section>
  );
}
