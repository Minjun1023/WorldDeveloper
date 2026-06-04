"use client";

import { useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { recordEvent } from "@/lib/feedback";
import type { RecommendationItem } from "@/lib/types";

export type Reaction = "like" | "dislike" | null;

export function InteractiveJobCard({
  item,
  rank,
  initialSaved,
  initialReaction,
  onSaveChange,
  onDislike,
}: {
  item: RecommendationItem;
  rank: number;
  initialSaved: boolean;
  initialReaction: Reaction;
  onSaveChange: (jobId: string, saved: boolean) => void;
  onDislike: (jobId: string) => void;
}) {
  const jobId = item.job.id;
  const [saved, setSaved] = useState(initialSaved);
  const [reaction, setReaction] = useState<Reaction>(initialReaction);

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    onSaveChange(jobId, next);
    try {
      const res = await fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSaved(!next);
      onSaveChange(jobId, !next);
    }
  }

  async function like() {
    const next: Reaction = reaction === "like" ? null : "like";
    setReaction(next);
    try {
      if (next) {
        await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: "like" }),
        });
      } else {
        await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      }
    } catch { /* 무시 */ }
  }

  async function dislike() {
    setReaction("dislike");
    try {
      await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: "dislike" }),
      });
    } catch { /* 무시 */ }
    onDislike(jobId);
  }

  return (
    <div className="flex flex-col">
      <div onClickCapture={() => recordEvent(jobId, "click", { rank, score: item.score.final_score })}>
        <RecommendationCard item={item} rank={rank} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-caption">
        <button type="button" onClick={toggleSave} aria-pressed={saved}
          className={saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
          {saved ? "저장됨" : "저장"}
        </button>
        <button type="button" onClick={like} aria-pressed={reaction === "like"}
          className={reaction === "like" ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
          좋아요
        </button>
        <button type="button" onClick={dislike}
          className="text-muted-foreground hover:text-destructive">
          관심 없음
        </button>
      </div>
    </div>
  );
}
