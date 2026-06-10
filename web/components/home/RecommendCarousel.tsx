"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Lock } from "lucide-react";
import { useRef } from "react";

// 맞춤 추천 미리보기 캐러셀. 헤더(eyebrow + 제목 + 잠금 배지) + 좌우 화살표 + 가로 스크롤 카드열.
// 카드는 서버 컴포넌트(RecommendPreviewCard)로 만들어 children 으로 주입받는다.
export function RecommendCarousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-caption font-semibold uppercase tracking-wide text-primary">
              맞춤 추천 미리보기
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-caption font-medium text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              로그인 시 이용 가능
            </span>
          </div>
          <h2 className="text-h1">당신을 위한 6차원 매칭 공고</h2>
          <p className="mt-2 text-body-sm text-muted-foreground">
            프로필 기반으로 스택·비자·지역·레벨·연봉·의미 6축 점수를 계산해드려요. 아래는 예시예요.
          </p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            aria-label="이전"
            onClick={() => scrollBy(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="다음"
            onClick={() => scrollBy(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-accent"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}
