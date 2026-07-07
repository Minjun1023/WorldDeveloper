"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { useSaveJob } from "@/lib/saved-jobs";
import { cn } from "@/lib/utils";

// 공고 상세/모바일바 저장 토글 — 아이콘만(하트). 공유 스토어(useSaveJob)를 단일 소스로 사용해
// 상세에서 저장하면 검색·추천 하트도 즉시 동기화된다(새로고침 불필요).
export function SaveJobButton({ jobId, loggedIn, className }: { jobId: string; loggedIn: boolean; className?: string }) {
  const { saved, toggle } = useSaveJob(jobId, loggedIn);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/jobs/${encodeURIComponent(jobId)}`)}`}
        aria-label="관심 공고로 저장 (로그인 필요)"
        title="저장하려면 로그인하세요"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0 [&_svg]:size-5", className)}
      >
        <Bookmark aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={saved ? "관심 공고 저장됨" : "관심 공고로 저장"}
      aria-pressed={saved}
      title={saved ? "저장됨 (클릭해 해제)" : "관심 공고로 저장"}
      className={cn("shrink-0 [&_svg]:size-5", saved && "text-primary", className)}
    >
      <Bookmark className={cn(saved && "fill-current")} aria-hidden="true" />
    </Button>
  );
}
