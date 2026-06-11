import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary } from "@/lib/types";

// 전폭 흰색 히어로 — lg 2단(좌 콘텐츠 좌측정렬 / 우 실데이터 통계). 카피·데이터 변경 없음.
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
      {/* 좌상단 은은한 브랜드 틴트 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(50% 70% at 18% -10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-container px-4 py-14 sm:py-20">
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
              비자 스폰서십이 명시된 공고만,{" "}
              <strong className="font-semibold text-foreground">6차원 점수</strong>로 추천. 매칭 근거
              문장까지 함께 보여드려요.
            </p>

            <HeroSearch regions={regions} />

            <SponsorChips companies={sponsorCompanies} />

            {/* 모바일/태블릿: 통계는 본문 아래 */}
            <div className="mt-10 lg:hidden">
              <HeroStats stats={stats} />
            </div>
          </div>

          {/* 우(lg): 통계 2×2 */}
          <aside className="hidden lg:block">
            <HeroStats stats={stats} compact />
          </aside>
        </div>
      </div>
    </section>
  );
}
