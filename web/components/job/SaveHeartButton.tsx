"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

// 잡 행/카드용 경량 관심(저장) 하트. 목록에서 N개 렌더되므로 초기 상태 조회는 하지 않고
// 낙관적 토글만 한다(상세의 SaveJobButton 과 달리 가벼움). 비로그인은 로그인으로 유도.
// JobRow 의 stretched-link 위에 떠야 하므로 relative z-10.
const BTN =
  "relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SaveHeartButton({ jobId, loggedIn }: { jobId: string; loggedIn: boolean }) {
  const [saved, setSaved] = useState(false);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/jobs/${encodeURIComponent(jobId)}`)}`}
        aria-label="관심 공고로 저장 (로그인 필요)"
        title="저장하려면 로그인하세요"
        onClick={(e) => e.stopPropagation()}
        className={cn(BTN, "text-muted-foreground hover:text-primary")}
      >
        <Heart className="h-[18px] w-[18px]" aria-hidden="true" />
      </Link>
    );
  }

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next); // 낙관적
    fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" }).catch(() =>
      setSaved(!next),
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "관심 공고 저장됨" : "관심 공고로 저장"}
      title={saved ? "저장됨 (클릭해 해제)" : "관심 공고로 저장"}
      className={cn(BTN, saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
    >
      <Heart className={cn("h-[18px] w-[18px]", saved && "fill-current")} aria-hidden="true" />
    </button>
  );
}
