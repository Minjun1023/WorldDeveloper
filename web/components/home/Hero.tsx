import { ShieldCheck } from "lucide-react";

import { HeroJobCard } from "@/components/home/HeroJobCard";
import { HeroSearch } from "@/components/home/HeroSearch";
import { PopularSearches } from "@/components/home/PopularSearches";
import type { RegionCount } from "@/lib/api";
import type { Job } from "@/lib/types";

// 전폭 히어로 — lg 2단(좌 콘텐츠 / 우 실제 공고 카드). 회사 로고는 통계 띠 아래 마퀴로 분리.
// 주의: 지역 드롭다운이 섹션 밖으로 펼쳐지므로 overflow-hidden 을 두지 않는다(드롭다운 잘림 방지).
export function Hero({
  regions,
  popularSearches = [],
  featuredJob = null,
}: {
  regions: RegionCount[];
  popularSearches?: string[];
  featuredJob?: Job | null;
}) {
  return (
    <section className="section-muted relative border-b border-border">
      <div className="relative mx-auto max-w-container px-4 py-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_440px]">
          {/* 좌: 콘텐츠 */}
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold text-primary"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              비자 스폰서십 검증 · 5축 매칭
            </span>

            <h1 className="mt-5 max-w-2xl text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[3.25rem]">
              해외 취업,
              <br />
              <span className="text-gradient-brand">비자부터 확인하세요.</span>
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-muted-foreground">
              정부 명부(USCIS·UK 내무부·NL IND) 교차검증을 통과한 비자 스폰서십 명시 공고만 모아,{" "}
              <strong className="font-semibold text-foreground">5축 매칭 점수</strong>로 가장 승인
              확률이 높은 포지션을 추천해요.
            </p>

            <HeroSearch regions={regions} />

            {/* 인기 검색어(실측) — 콜드스타트엔 큐레이션 '추천'으로 fallback */}
            <PopularSearches terms={popularSearches} />

            {/* 검색=키워드, 추천=프로필 기반 5축 매칭(상단 내비 '맞춤 추천'에서 이용). */}
            <p className="mt-4 text-caption text-muted-foreground">
              검색은 키워드로 공고를 찾고, 추천은 내 프로필을 5가지 기준(스택·지역·레벨·연봉·의미)으로
              맞춰드려요.
            </p>
          </div>

          {/* 우: 실제 공고 카드(5축 매칭 미리보기) — 모바일에선 본문 아래로 쌓임 */}
          <aside>
            <HeroJobCard job={featuredJob} />
          </aside>
        </div>
      </div>
    </section>
  );
}
