import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { HeroPreviewCard } from "@/components/home/HeroPreviewCard";
import { HeroSearch } from "@/components/home/HeroSearch";
import type { RegionCount } from "@/lib/api";
import type { RecommendationItem } from "@/lib/types";

// 전폭 히어로 — lg 2단(좌 콘텐츠 / 우 6차원 매칭 미리보기). 통계는 아래 StatsBand 로 분리.
export function Hero({
  regions,
  previewItem,
  loggedIn = false,
}: {
  regions: RegionCount[];
  previewItem?: RecommendationItem | null;
  loggedIn?: boolean;
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
          {/* 좌: 콘텐츠 */}
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold text-primary"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified Visa Sponsorship Only
            </span>

            <h1 className="mt-5 max-w-2xl text-[2rem] font-extrabold leading-[1.15] tracking-tight sm:text-[2.75rem]">
              한국 개발자의 해외 취업,
              <br />
              <span className="text-gradient-brand">비자부터 확인하세요.</span>
            </h1>
            <p className="mt-4 max-w-xl text-body text-muted-foreground">
              정부 명부(USCIS·UK 내무부·NL IND) 교차검증을 통과한 비자 스폰서십 명시 공고만 모아,{" "}
              <strong className="font-semibold text-foreground">6차원 매칭 점수</strong>로 가장 승인
              확률이 높은 포지션을 추천해요.
            </p>

            <HeroSearch regions={regions} />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={loggedIn ? "/me/profile" : "/signup"}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-body-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                내 프로필 만들기
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                공고 둘러보기
              </Link>
            </div>

            {/* 모바일/태블릿: 미리보기는 본문 아래 */}
            {previewItem && <div className="mt-10 lg:hidden">{<HeroPreviewCard item={previewItem} />}</div>}
          </div>

          {/* 우(lg): 6차원 매칭 미리보기 */}
          {previewItem && (
            <aside className="hidden lg:block">
              <HeroPreviewCard item={previewItem} />
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
