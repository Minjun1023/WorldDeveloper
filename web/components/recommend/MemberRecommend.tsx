"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordEvents } from "@/lib/feedback";
import { useCachedRecommend } from "@/lib/use-recommend";

// 추천 "작업공간": 홈 미리보기(3개)와 달리 큰 풀(POOL)을 받아 '더 보기'로 점진 노출 + 조건(note) 입력 + 저장/반응.
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩. '적용'으로 재요청.
const POOL = 60; // 백엔드에서 받아오는 추천 풀(회사당 최대 2개 다양성 제약 안에서 상위 60).
const PAGE = 12; // 처음 노출/‘더 보기’ 1회당 추가 노출 수(3열 × 4행).

export function MemberRecommend({ initialNote }: { initialNote?: string } = {}) {
  const [note, setNote] = useState(initialNote ?? "");
  const [shown, setShown] = useState(PAGE);
  const { loading, needsProfile, error, result, visible, saved, reactions, run, onSaveChange, onDislike } =
    useCachedRecommend({ cacheKey: "full", topK: POOL, impressionCount: PAGE });

  // 히어로 '맞춤 매칭'에서 조건(?note=)을 들고 진입한 경우 마운트 시 1회 적용(입력칸은 미리 채워둠).
  useEffect(() => {
    const seed = initialNote?.trim();
    if (seed) {
      setShown(PAGE);
      run(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = visible.slice(0, shown);
  const remaining = visible.length - items.length;

  // '적용'으로 새 조건 조회 시 노출 수를 첫 페이지로 리셋(새 결과를 처음부터 보게).
  const applyNote = (e: React.FormEvent) => {
    e.preventDefault();
    setShown(PAGE);
    run(note.trim() || undefined);
  };

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
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">프로필을 작성하면 맞춤 공고를 추천해드려요.</p>
        <Link href="/me/profile" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
          프로필 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applyNote} className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="조건 추가(선택): 예) 베를린 우선, 시니어" className="flex-1" />
        <Button type="submit" disabled={loading}>적용</Button>
      </form>
      {loading && <RecommendationSkeleton count={9} message="프로필로 6차원 점수를 계산하는 중…" />}
      {error && <p className="text-body-sm text-destructive">추천 실패: {error}</p>}
      {result && !loading && (visible.length === 0
        ? <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
        : <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
