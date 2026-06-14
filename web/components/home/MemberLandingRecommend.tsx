"use client";

import Link from "next/link";

import { SectionHeader } from "@/components/home/SectionHeader";
import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import { useCachedRecommend } from "@/lib/use-recommend";

// 홈은 "미리보기" 역할만: 1행(3개) 티저, 전체 목록·조건 입력은 /recommend. (역할 분리)
// 결과는 캐시(useCachedRecommend) — 재방문 시 즉시 표시, 첫 방문에만 로딩.
const TOP_N = 3;

export function MemberLandingRecommend() {
  // cacheKey 'landing-v2': 과거 삭제(관심없음) 클릭으로 1건 숨겨진 채 캐시된 결과를 무효화
  // (삭제 버튼 제거 이후엔 다시 3개가 정상 표시되도록 새 키로 재패치 유도).
  const { loading, needsProfile, result, visible, saved, reactions, onSaveChange, onDislike } =
    useCachedRecommend({ cacheKey: "landing-v2", topK: TOP_N });

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
        overline="맞춤 추천 미리보기"
        title="당신을 위한 6차원 매칭 공고"
        subtitle="프로필 기반으로 스택·비자·지역·레벨·연봉·의미 6축 점수를 계산했어요."
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
