"use client";

import { Heart, Trash2 } from "lucide-react";
import { useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { recordEvent } from "@/lib/feedback";
import type { RecommendationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

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
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label={saved ? "저장됨" : "저장"}
          title={saved ? "저장됨" : "저장"}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            saved ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={dislike}
          disabled={reaction === "dislike"}
          aria-label="관심 없음"
          title="관심 없음 (목록에서 삭제)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
