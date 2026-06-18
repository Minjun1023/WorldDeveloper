"use client";

import { Flag, ThumbsUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReportDialog } from "@/components/community/ReportDialog";
import { cn } from "@/lib/utils";

// 글 하단 액션: 추천 토글 / 신고 / (작성자) 삭제.
export function PostInteractions({
  postId,
  initialReacted,
  initialScore,
  loggedIn,
  mine,
}: {
  postId: string;
  initialReacted: boolean;
  initialScore: number;
  loggedIn: boolean;
  mine: boolean;
}) {
  const router = useRouter();
  const [reacted, setReacted] = useState(initialReacted);
  const [score, setScore] = useState(initialScore);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(`/signin?callbackUrl=/community/${postId}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/reactions`, { method: "POST" });
      if (res.ok) {
        const d = (await res.json()) as { reacted: boolean; score: number };
        setReacted(d.reacted);
        setScore(d.score);
      }
    } finally {
      setBusy(false);
    }
  }

  function report() {
    if (!loggedIn) {
      router.push(`/signin?callbackUrl=/community/${postId}`);
      return;
    }
    setReportOpen(true);
  }

  async function remove() {
    if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) return;
    const res = await fetch(`/api/community/posts/${postId}`, { method: "DELETE" });
    if (res.ok) router.push("/community");
  }

  return (
    <>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={reacted}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-colors",
          reacted ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        추천 {score > 0 && <span className="tabular-nums">{score}</span>}
      </button>

      <button
        type="button"
        onClick={report}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        신고
      </button>

      {mine && (
        <button
          type="button"
          onClick={remove}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          삭제
        </button>
      )}
    </div>
    <ReportDialog
      open={reportOpen}
      onClose={() => setReportOpen(false)}
      targetType="post"
      targetId={postId}
      onHidden={() => router.push("/community")}
    />
    </>
  );
}
