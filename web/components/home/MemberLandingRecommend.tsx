"use client";

import { SectionHeader } from "@/components/home/SectionHeader";
import { LockedRecommendPreview } from "@/components/home/LockedRecommendPreview";
import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";
import { useCachedRecommend } from "@/lib/use-recommend";

// 홈은 "미리보기" 역할만: 1행(3개) 티저, 전체 목록·조건 입력은 /recommend. (역할 분리)
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩.
const TOP_N = 3;

export function MemberLandingRecommend({ teaserJobs = [] }: { teaserJobs?: Job[] }) {
  // 캐시 무효화는 recommend-cache PREFIX 버전(v2)으로 일괄 처리 → 키는 깔끔하게 'landing' 유지.
  const { loading, needsProfile, result, visible } = useCachedRecommend({
    cacheKey: "landing",
    topK: TOP_N,
  });

  if (loading) return <p className="text-body-sm text-muted-foreground">맞춤 공고를 불러오는 중…</p>;
  // 프로필 미작성 — 비로그인과 동일한 잠금 티저(블러 실공고 + 중앙 CTA), CTA 만 프로필 작성으로.
  if (needsProfile) {
    return <LockedRecommendPreview mode="profile" jobs={teaserJobs} />;
  }
  if (!result || result.recommendations.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="맞춤 추천 공고"
        subtitle="프로필 기반 5축 매칭"
        href="/recommend"
        hrefLabel="추천 전체 보기"
      />
      {/* 홈은 표준 JobCard 그리드로 컴팩트하게(인기 TOP 과 동일 룩) — 레이더·이유 칩 등
          5축 상세 분석은 /recommend 워크스페이스가 담당. 차별점인 매칭 점수만 아이브로로 유지. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, i) => (
          <div key={item.job.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-caption">
              <span className="font-semibold text-muted-foreground">#{i + 1}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                매칭 {Math.round(item.score.final_score * 100)}점
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <JobCard job={item.job} showSave loggedIn />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
