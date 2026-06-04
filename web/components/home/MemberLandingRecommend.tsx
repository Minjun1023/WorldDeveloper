"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InteractiveJobCard, type Reaction } from "@/components/recommend/InteractiveJobCard";
import { recordEvents } from "@/lib/feedback";
import type { RecommendResponse } from "@/lib/types";

const TOP_N = 6;

export function MemberLandingRecommend() {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [recRes, interRes] = await Promise.all([
          fetch("/api/me/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: null }) }),
          fetch("/api/me/interactions"),
        ]);
        if (recRes.status === 409) { setNeedsProfile(true); return; }
        if (!recRes.ok) return;
        const rec: RecommendResponse = await recRes.json();
        setResult(rec);
        if (interRes.ok) {
          const it = await interRes.json();
          setSaved(new Set<string>(it.saved ?? []));
          setReactions(it.reactions ?? {});
        }
        const top = rec.recommendations.slice(0, TOP_N);
        recordEvents(top.map((item, i) => ({ job_id: item.job.id, action: "impression" as const, rank: i + 1, score: item.score.final_score })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const visible = result.recommendations.slice(0, TOP_N).filter((it) => !hidden.has(it.job.id));
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">회원님 맞춤 공고</h2>
        <Link href="/recommend" className="text-body-sm text-primary">더 보기 →</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </section>
  );
}
