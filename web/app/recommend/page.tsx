"use client";

import { useState } from "react";

import { ProfileForm } from "@/components/recommend/ProfileForm";
import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import type { RecommendProfile, RecommendResponse } from "@/lib/types";

export default function RecommendPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  async function handleSubmit(profile: RecommendProfile) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">맞춤 추천</h1>
        <p className="mt-2 text-muted-foreground">
          프로필을 입력하면 6차원 점수(스택·비자·지역·레벨·연봉·의미 유사도)로 공고를 추천해요.
        </p>
      </section>

      <ProfileForm onSubmit={handleSubmit} loading={loading} />

      {loading && (
        <RecommendationSkeleton count={9} message="6차원 점수를 계산하는 중…" />
      )}

      {error && (
        <div className="rounded-lg border border-border bg-surface p-4 text-body-sm text-destructive">
          추천 실패: {error}
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h2">추천 결과</h2>
            <span className="text-caption text-muted-foreground">
              후보 {result.total_candidates}개 중 {result.returned}개
            </span>
          </div>
          {result.recommendations.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendations.map((item, i) => (
                <RecommendationCard key={item.job.id} item={item} rank={i + 1} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
