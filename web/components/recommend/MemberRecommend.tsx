"use client";

import Link from "next/link";
import { useState } from "react";

import { AlertToggleCard } from "@/components/alerts/AlertToggleCard";
import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { recordEvents } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { useCachedRecommend } from "@/lib/use-recommend";

// 추천 "작업공간": 홈 미리보기(3개)와 달리 큰 풀(POOL)을 받아 '더 보기'로 점진 노출 + 저장/반응.
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩. 조건은 프로필(/me/profile)에서 수정.
const POOL = 60; // 백엔드에서 받아오는 추천 풀(회사당 최대 2개 다양성 제약 안에서 상위 60).
const PAGE = 12; // 처음 노출/‘더 보기’ 1회당 추가 노출 수(3열 × 4행).

export function MemberRecommend() {
  const [shown, setShown] = useState(PAGE);
  const { loading, needsProfile, error, result, visible, saved, reactions, onSaveChange, onDislike } =
    useCachedRecommend({ cacheKey: "full", topK: POOL, impressionCount: PAGE });

  const items = visible.slice(0, shown);
  const remaining = visible.length - items.length;

  // '더 보기': 다음 PAGE만큼 추가 노출 + 새로 보이는 카드만 임프레션 기록(과집계 방지).
  const showMore = () => {
    recordEvents(
      visible.slice(shown, shown + PAGE).map((item, i) => ({
        job_id: item.job.id,
        action: "impression" as const,
        rank: shown + i + 1,
        score: item.score.final_score,
      })),
    );
    setShown((s) => s + PAGE);
  };

  if (needsProfile) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-body-sm text-muted-foreground">프로필을 작성하면 맞춤 공고를 추천해드려요.</p>
        <Link href="/me/profile" className={cn(buttonVariants(), "mt-3")}>
          프로필 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 추천은 내 프로필 기준. 조건 수정은 프로필 페이지에서. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-muted-foreground">
          내 프로필(스택·지역·레벨·연봉·관심 도메인) 기준으로 매칭합니다. 조건을 바꾸려면 프로필을 수정하세요.
        </p>
        <Link
          href="/me/profile"
          className={cn(buttonVariants({ variant: "default" }), "shrink-0")}
        >
          프로필 수정
        </Link>
      </div>
      {/* 옵트인 알림 — 프로필 저장은 구독 의사가 아니므로 기본 꺼짐(defaultOn=false). */}
      <AlertToggleCard
        endpoint="/api/me/match-alerts"
        title="맞춤 공고 이메일 알림"
        description="프로필과 잘 맞는 새 공고(매칭 60% 이상)가 올라오면 매일 아침 이메일로 알려드려요."
        defaultOn={false}
      />
      {loading && <RecommendationSkeleton count={9} message="프로필로 5축 점수를 계산하는 중…" />}
      {error && <p className="text-body-sm text-destructive">추천 실패: {error}</p>}
      {result && !loading && (visible.length === 0
        ? <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
        : <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <InteractiveJobCard
                  key={item.job.id}
                  item={item}
                  rank={i + 1}
                  initialSaved={saved.has(item.job.id)}
                  initialReaction={reactions[item.job.id] ?? null}
                  onSaveChange={onSaveChange}
                  onDislike={onDislike}
                />
              ))}
            </div>
            {remaining > 0 && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="outline" onClick={showMore}>
                  더 많은 추천 보기 ({remaining}개 더)
                </Button>
              </div>
            )}
          </>)}
    </div>
  );
}
