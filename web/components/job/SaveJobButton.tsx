"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { useSaveJob } from "@/lib/saved-jobs";
import { cn } from "@/lib/utils";

// 공고 상세/모바일바 저장 토글 — 아이콘만(하트). 공유 스토어(useSaveJob)를 단일 소스로 사용해
// 상세에서 저장하면 검색·추천 하트도 즉시 동기화된다(새로고침 불필요).
const ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SaveJobButton({ jobId, loggedIn, className }: { jobId: string; loggedIn: boolean; className?: string }) {
  const { saved, toggle } = useSaveJob(jobId, loggedIn);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/jobs/${encodeURIComponent(jobId)}`)}`}
        aria-label="저장"
        title="저장하려면 로그인하세요"
        className={cn(ICON_BTN, "border-border text-foreground hover:bg-accent", className)}
      >
        <Bookmark className="h-5 w-5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? "저장됨" : "저장"}
      aria-pressed={saved}
      title={saved ? "저장됨 (클릭해 해제)" : "저장"}
      className={cn(
        ICON_BTN,
        saved ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent",
        className,
      )}
    >
      <Bookmark className={cn("h-5 w-5", saved && "fill-current")} aria-hidden="true" />
    </button>
  );
}
