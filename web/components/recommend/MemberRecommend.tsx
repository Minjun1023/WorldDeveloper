"use client";

import Link from "next/link";
import { useState } from "react";

import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCachedRecommend } from "@/lib/use-recommend";

// 추천 "작업공간": 홈 미리보기(3개)와 달리 전체 20개 + 조건(note) 입력 + 저장/반응.
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩. '적용'으로 재요청.
const TOP_K = 20;

export function MemberRecommend() {
  const [note, setNote] = useState("");
  const { loading, needsProfile, error, result, visible, saved, reactions, run, onSaveChange, onDislike } =
    useCachedRecommend({ cacheKey: "full", topK: TOP_K });

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
      <form onSubmit={(e) => { e.preventDefault(); run(note.trim() || undefined); }} className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="조건 추가(선택): 예) 베를린 우선, 시니어" className="flex-1" />
        <Button type="submit" disabled={loading}>적용</Button>
      </form>
      {loading && <RecommendationSkeleton count={9} message="프로필로 6차원 점수를 계산하는 중…" />}
      {error && <p className="text-body-sm text-destructive">추천 실패: {error}</p>}
      {result && !loading && (visible.length === 0
        ? <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item, i) => (
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
          </div>)}
    </div>
  );
}
