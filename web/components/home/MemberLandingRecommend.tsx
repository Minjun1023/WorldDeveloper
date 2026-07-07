"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SectionHeader } from "@/components/home/SectionHeader";
import { LockedRecommendPreview } from "@/components/home/LockedRecommendPreview";
import { JobCard } from "@/components/job/JobCard";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/types";
import { useCachedRecommend } from "@/lib/use-recommend";

// 홈은 "미리보기" 역할만: 표준 JobCard 슬라이드(3장씩), 전체 목록·조건 입력은 /recommend.
// 매칭 점수는 카드 안(제목 우측 필)으로 — 랭크(#N)·레이더 등 분석 요소는 /recommend 담당.
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩.
const POOL = 9; // 슬라이드로 넘겨볼 추천 풀(3장 × 3페이지)

export function MemberLandingRecommend({ teaserJobs = [] }: { teaserJobs?: Job[] }) {
  // 캐시 키에 topK 가 포함되지 않아, 3장 시절 캐시와 분리되도록 키를 분리(-carousel).
  const { loading, needsProfile, result, visible } = useCachedRecommend({
    cacheKey: "landing-carousel",
    topK: POOL,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // 스크롤 위치에 따라 화살표 활성/비활성 동기화(끝에서 비활성).
  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncArrows();
    // 카드 로드/리사이즈 후 오버플로 여부가 바뀔 수 있어 리사이즈에도 동기화.
    window.addEventListener("resize", syncArrows);
    return () => window.removeEventListener("resize", syncArrows);
  }, [syncArrows, visible.length]);

  const slide = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  if (loading) return <p className="text-body-sm text-muted-foreground">맞춤 공고를 불러오는 중…</p>;
  // 프로필 미작성 — 비로그인과 동일한 잠금 티저(블러 실공고 + 중앙 CTA), CTA 만 프로필 작성으로.
  if (needsProfile) {
    return <LockedRecommendPreview mode="profile" jobs={teaserJobs} />;
  }
  if (!result || result.recommendations.length === 0) return null;

  const hasOverflow = canPrev || canNext;

  return (
    <section>
      <SectionHeader
        title="맞춤 추천 공고"
        subtitle="프로필 기반 5축 매칭"
        href="/recommend"
        hrefLabel="추천 전체 보기"
      />
      <div className="relative">
        {/* 슬라이드 트랙 — 스크롤 스냅(3장/2장/1장 반응형), 스크롤바 숨김 */}
        <div
          ref={scrollRef}
          onScroll={syncArrows}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visible.map((item) => (
            <div
              key={item.job.id}
              className="min-w-0 shrink-0 snap-start basis-full sm:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-1.5rem)/3)]"
            >
              <JobCard
                job={item.job}
                showSave
                loggedIn
                matchScore={Math.round(item.score.final_score * 100)}
              />
            </div>
          ))}
        </div>

        {/* 좌우 화살표 — 카드와 겹치지 않도록 트랙 바깥(-left/right-10 = 버튼 36px + 여백 4px)에 배치.
            바깥 여백이 없는 좁은 화면(lg 미만)에선 숨김 — 터치/트랙패드 스와이프로 대체. */}
        {hasOverflow && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="이전 추천 보기"
              disabled={!canPrev}
              onClick={() => slide(-1)}
              className="absolute -left-10 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-background shadow-md lg:inline-flex"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="다음 추천 보기"
              disabled={!canNext}
              onClick={() => slide(1)}
              className="absolute -right-10 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-background shadow-md lg:inline-flex"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
