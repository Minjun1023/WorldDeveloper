import Link from "next/link";

import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { NlRecommend, type RecommendPreset } from "@/components/home/NlRecommend";
import { SponsorChips } from "@/components/home/SponsorChips";
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
}: {
  stats: HomeStats;
  sponsorCompanies: CompanySummary[];
}) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <CredibilityPill />

      <h1 className="mt-4 text-display">
        조건만 말하면, AI가{" "}
        <span className="font-serif italic text-verified">실제로 채용 가능한</span>{" "}
        <span className="text-primary">비자 스폰서</span> 공고를 찾아드려요
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        이력서·기술스택·원하는 조건을 자유롭게 적어보세요. 6차원 점수로 추천합니다.
      </p>

      <div className="mx-auto mt-6 max-w-2xl text-left">
        <NlRecommend presets={HERO_PRESETS} />
      </div>

      <p className="mt-3 text-body-sm text-muted-foreground">
        또는{" "}
        <Link href="/search" className="underline hover:text-foreground">
          조건으로 직접 검색
        </Link>
      </p>

      <SponsorChips companies={sponsorCompanies} />

      <HeroStats stats={stats} />
    </section>
  );
}
