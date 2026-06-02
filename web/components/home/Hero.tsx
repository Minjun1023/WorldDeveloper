import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { type RecommendPreset } from "@/components/home/NlRecommend";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary } from "@/lib/types";

const HERO_PRESETS: RecommendPreset[] = [
  { label: "비자 스폰서만", prompt: "비자 스폰서십 제공하는 백엔드 개발자 공고" },
  { label: "독일 백엔드", prompt: "독일 베를린 백엔드 개발자, 비자 스폰서 필요" },
  { label: "원격 시니어", prompt: "원격 가능한 시니어 소프트웨어 엔지니어" },
  { label: "AI/ML", prompt: "AI/ML 엔지니어, 비자 스폰서" },
];

export function Hero({
  stats,
  sponsorCompanies,
  regions,
}: {
  stats: HomeStats;
  sponsorCompanies: CompanySummary[];
  regions: RegionCount[];
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

      <HeroSearch presets={HERO_PRESETS} regions={regions} />

      <SponsorChips companies={sponsorCompanies} />

      <HeroStats stats={stats} />
    </section>
  );
}
