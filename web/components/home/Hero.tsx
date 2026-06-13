import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroPreviewCard } from "@/components/home/HeroPreviewCard";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary, RecommendationItem } from "@/lib/types";

// 전폭 흰색 히어로 — lg 2단(좌 콘텐츠 좌측정렬 / 우 실데이터 통계 + 6차원 매칭 미리보기).
export function Hero({
  stats,
  sponsorCompanies,
  regions,
  previewItem,
}: {
  stats: HomeStats;
  sponsorCompanies: CompanySummary[];
  regions: RegionCount[];
  previewItem?: RecommendationItem | null;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* 좌상단 은은한 브랜드 틴트 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(50% 70% at 18% -10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-container px-4 py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px]">
          {/* 좌: 콘텐츠(좌측정렬) */}
          <div className="min-w-0">
            <CredibilityPill sponsorCount={stats.sponsors} />

            <h1 className="mt-5 max-w-2xl text-[2rem] font-extrabold leading-[1.15] tracking-tight sm:text-[2.75rem]">
              한국 개발자의 해외 취업,
              <br />
              <span className="text-gradient-brand">비자부터 확인하세요.</span>
            </h1>
            <p className="mt-4 max-w-xl text-body text-muted-foreground">
              정부 명부(USCIS·UK 내무부·NL IND)로 교차검증된 비자 스폰서십 명시 공고만 모아,{" "}
              <strong className="font-semibold text-foreground">6차원 점수</strong>로 추천해요. 매칭
              근거 문장까지 함께 보여드려요.
            </p>

            <HeroSearch regions={regions} />

            <SponsorChips companies={sponsorCompanies} />

            {/* 모바일/태블릿: 통계 + 미리보기는 본문 아래 */}
            <div className="mt-10 space-y-4 lg:hidden">
              <HeroStats stats={stats} />
              {previewItem && <HeroPreviewCard item={previewItem} />}
            </div>
          </div>

          {/* 우(lg): 통계 2×2 + 6차원 매칭 미리보기 */}
          <aside className="hidden space-y-4 lg:block">
            <HeroStats stats={stats} compact />
            {previewItem && <HeroPreviewCard item={previewItem} />}
          </aside>
        </div>
      </div>
    </section>
  );
}
