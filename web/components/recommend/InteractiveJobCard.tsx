"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { recordEvent } from "@/lib/feedback";
import { setSavedLocal } from "@/lib/saved-jobs";
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
  showDislike = true,
}: {
  item: RecommendationItem;
  rank: number;
  initialSaved: boolean;
  initialReaction: Reaction;
  onSaveChange: (jobId: string, saved: boolean) => void;
  onDislike: (jobId: string) => void;
  // 랜딩 미리보기에선 false — 삭제(관심없음)는 즉시 카드를 지워 미리보기가 줄어들고 오클릭 위험.
  // 저장/삭제 같은 변경 액션은 /recommend 작업공간에서만. (삭제는 빼고 저장 하트는 유지)
  showDislike?: boolean;
}) {
  const jobId = item.job.id;
  const [saved, setSaved] = useState(initialSaved);
  const [reaction, setReaction] = useState<Reaction>(initialReaction);

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    setSavedLocal(jobId, next); // 공유 스토어 동기화(검색·상세 하트 반영)
    onSaveChange(jobId, next);
    try {
      const res = await fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSaved(!next);
      setSavedLocal(jobId, !next); // 롤백
      onSaveChange(jobId, !next);
    }
  }

  async function dislike() {
    setReaction("dislike");
    try {
      const res = await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: "dislike" }),
      });
      if (res.ok) {
        onDislike(jobId);     // 서버 반영 성공 시에만 숨김(새로고침 시 재등장 방지)
      } else {
        setReaction(null);    // 실패 → 원복(재시도 가능)
      }
    } catch {
      setReaction(null);
    }
  }

  const actions = (
    <>
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={saved}
        aria-label={saved ? "관심 공고 저장됨" : "관심 공고로 저장"}
        title={saved ? "관심 공고 저장됨" : "관심 공고로 저장"}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          saved ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
      >
        <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {showDislike && (
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
      )}
    </>
  );

  return (
    // 카드 클릭(공고 보기) 만 click 이벤트로 기록 — 우측 상단 액션 버튼 클릭은 제외.
    // h-full: 그리드 셀을 가득 채워 내부 카드가 같은 행 높이로 늘어나도록.
    <div
      className="h-full"
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        recordEvent(jobId, "click", { rank, score: item.score.final_score });
      }}
    >
      <RecommendationCard item={item} rank={rank} actions={actions} />
    </div>
  );
}
