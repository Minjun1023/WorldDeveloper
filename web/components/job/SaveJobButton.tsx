"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// 공고 상세 저장 토글 — 아이콘만(하트). 라벨은 aria-label/title 로 제공(시각 텍스트 없음).
// 기존 /api/me/saved/{jobId} PUT/DELETE 재사용. 초기 상태는 /api/me/interactions 로 1회 동기화.
// 낙관적 토글 + 실패 시 롤백. 상세카드·모바일 하단바 공용(정사각 44px 터치타겟).
const ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SaveJobButton({ jobId, loggedIn, className }: { jobId: string; loggedIn: boolean; className?: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    fetch("/api/me/interactions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.saved)) setSaved(d.saved.includes(jobId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [jobId, loggedIn]);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/jobs/${encodeURIComponent(jobId)}`)}`}
        aria-label="저장"
        title="저장하려면 로그인하세요"
        className={cn(ICON_BTN, "border-border text-foreground hover:bg-accent", className)}
      >
        <Heart className="h-5 w-5" aria-hidden="true" />
      </Link>
    );
  }

  async function toggle() {
    const next = !saved;
    setSaved(next); // 낙관적
    try {
      const res = await fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" });
      if (!res.ok) setSaved(!next); // 서버 거절(비2xx)도 롤백
    } catch {
      setSaved(!next); // 롤백
    }
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
      <Heart className={cn("h-5 w-5", saved && "fill-current")} aria-hidden="true" />
    </button>
  );
}
