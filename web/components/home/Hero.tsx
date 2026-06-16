import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroVisual } from "@/components/home/HeroVisual";
import type { RegionCount } from "@/lib/api";
import type { CompanySummary } from "@/lib/types";

// 전폭 히어로 — lg 2단(좌 콘텐츠 / 우 검증 회사 로고 월). 통계는 아래 StatsBand 로 분리.
// 주의: 지역 드롭다운이 섹션 밖으로 펼쳐지므로 overflow-hidden 을 두지 않는다(드롭다운 잘림 방지).
export function Hero({
  regions,
  companies = [],
  companyCount = 0,
  loggedIn = false,
}: {
  regions: RegionCount[];
  companies?: CompanySummary[];
  companyCount?: number;
  loggedIn?: boolean;
}) {
  return (
    <section className="relative border-b border-border">
      <div className="relative mx-auto max-w-container px-4 py-12 sm:py-16">
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

            {/* 검색(위)과 추천(아래)을 분리: 검색=키워드, 추천=프로필 기반 6축 매칭. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={loggedIn ? "/recommend" : "/signup"}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-body-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                프로필 작성하러가기
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                공고 둘러보기
              </Link>
            </div>
            <p className="mt-2.5 text-caption text-muted-foreground">
              검색은 키워드로 공고를 찾고, 추천은 내 프로필을 6가지 기준(스택·비자·지역·레벨·연봉·의미)으로
              맞춰드려요.
            </p>

            {/* 모바일/태블릿: 로고 월은 본문 아래 */}
            {companies.length > 0 && (
              <div className="mt-10 lg:hidden">
                <HeroVisual companies={companies} totalVerified={companyCount} />
              </div>
            )}
          </div>

          {/* 우(lg): 검증 회사 로고 월 */}
          {companies.length > 0 && (
            <aside className="hidden lg:block">
              <HeroVisual companies={companies} totalVerified={companyCount} />
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
