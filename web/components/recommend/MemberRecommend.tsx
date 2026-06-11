"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InteractiveJobCard, type Reaction } from "@/components/recommend/InteractiveJobCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordEvents } from "@/lib/feedback";
import type { RecommendResponse } from "@/lib/types";

// 추천 "작업공간": 홈 미리보기(3개)와 달리 전체 20개 + 조건(note) 입력 + 저장/반응.
const TOP_K = 20;

export function MemberRecommend() {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  async function run(noteText?: string) {
    setLoading(true); setError(null); setNeedsProfile(false);
    try {
      const res = await fetch("/api/me/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteText ?? null, top_k: TOP_K }),
      });
      if (res.status === 409) { setNeedsProfile(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rec: RecommendResponse = await res.json();
      setResult(rec);
      setHidden(new Set()); // 새 결과 = 숨김 초기화
      recordEvents(rec.recommendations.map((item, i) => ({
        job_id: item.job.id, action: "impression" as const, rank: i + 1, score: item.score.final_score,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      // 저장/반응 초기 상태를 먼저 적재(빠른 GET) — 카드가 mount 될 때 반영되도록.
      // InteractiveJobCard 는 initialSaved 를 useState 로 1회만 시드하므로 순서가 중요하다.
      try {
        const r = await fetch("/api/me/interactions");
        if (r.ok) {
          const it = await r.json();
          setSaved(new Set<string>(it.saved ?? []));
          setReactions(it.reactions ?? {});
        }
      } catch { /* 베스트 에포트 — 실패해도 추천 자체는 동작 */ }
      run();
    })();
  }, []);

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

  const visible = result ? result.recommendations.filter((it) => !hidden.has(it.job.id)) : [];

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
                onSaveChange={(jobId, s) => setSaved((prev) => { const n = new Set(prev); if (s) n.add(jobId); else n.delete(jobId); return n; })}
                onDislike={(jobId) => setHidden((prev) => new Set(prev).add(jobId))}
              />
            ))}
          </div>)}
    </div>
  );
}
