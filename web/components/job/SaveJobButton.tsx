"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// 공고 상세 저장 토글. 기존 /api/me/saved/{jobId} PUT/DELETE 재사용.
// 초기 상태는 /api/me/interactions(saved id 목록)로 1회 동기화. 낙관적 토글 + 실패 시 롤백.
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
        className={cn("inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-border px-4 text-body-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        <Heart className="h-4 w-4" aria-hidden="true" /> 저장
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
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border px-4 text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        saved ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
      {saved ? "저장됨" : "저장"}
    </button>
  );
}
