import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary } from "@/lib/types";

// 전폭 흰색 히어로 섹션(안쪽 max-w 컨테이너). Readdy 목업 대응.
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
    <section className="relative overflow-hidden">
      {/* 상단 은은한 브랜드 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 70% at 50% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-container px-4 py-16 text-center sm:py-24">
        <CredibilityPill sponsorCount={stats.sponsors} />

        <h1 className="mx-auto mt-6 max-w-3xl text-[2rem] font-bold leading-[1.15] tracking-tight sm:text-[2.875rem]">
          한국 개발자의 해외 취업,
          <br />
          <span className="text-gradient-brand">비자부터 확인하세요.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-body text-muted-foreground">
          비자 스폰서십이 명시된 공고만,{" "}
          <strong className="font-semibold text-foreground">6차원 점수</strong>로 추천. 매칭 근거
          문장까지 함께 보여드려요.
        </p>

        <HeroSearch regions={regions} />

        <SponsorChips companies={sponsorCompanies} />

        <HeroStats stats={stats} />
      </div>
    </section>
  );
}
