"use client";

import Link from "next/link";

import { SectionHeader } from "@/components/home/SectionHeader";
import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import { useCachedRecommend } from "@/lib/use-recommend";

// 홈은 "미리보기" 역할만: 1행(3개) 티저, 전체 목록·조건 입력은 /recommend. (역할 분리)
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩.
const TOP_N = 3;

export function MemberLandingRecommend() {
  // 캐시 무효화는 recommend-cache PREFIX 버전(v2)으로 일괄 처리 → 키는 깔끔하게 'landing' 유지.
  const { loading, needsProfile, result, visible, saved, reactions, onSaveChange, onDislike } =
    useCachedRecommend({ cacheKey: "landing", topK: TOP_N });

  if (loading) return <p className="text-body-sm text-muted-foreground">맞춤 공고를 불러오는 중…</p>;
  if (needsProfile) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">프로필을 작성하면 맞춤 공고를 받을 수 있어요.</p>
        <Link href="/me/profile" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
          프로필 작성하기
        </Link>
      </div>
    );
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, i) => (
          <InteractiveJobCard
            key={item.job.id}
            item={item}
            rank={i + 1}
            initialSaved={saved.has(item.job.id)}
            initialReaction={reactions[item.job.id] ?? null}
            onSaveChange={onSaveChange}
            onDislike={onDislike}
            showDislike={false}
          />
        ))}
      </div>
    </section>
  );
}
