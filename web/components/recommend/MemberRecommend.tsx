"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendResponse } from "@/lib/types";

export function MemberRecommend() {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [note, setNote] = useState("");

  async function run(noteText?: string) {
    setLoading(true); setError(null); setNeedsProfile(false);
    try {
      const res = await fetch("/api/me/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteText ?? null }),
      });
      if (res.status === 409) { setNeedsProfile(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(); }, []);

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
      {result && (result.recommendations.length === 0
        ? <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.recommendations.map((item, i) => <RecommendationCard key={item.job.id} item={item} rank={i + 1} />)}
          </div>)}
    </div>
  );
}
