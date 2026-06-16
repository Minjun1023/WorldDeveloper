"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// 관심 기업(즐겨찾기) 토글 — 회사 상세 히어로용 라벨 버튼(별).
// 기존 /api/me/favorite-companies PUT/DELETE 재사용. 초기 상태는 목록 1회 조회로 동기화.
// 낙관적 토글 + 실패 시 롤백. 로그아웃 시 로그인 유도 링크.
const PILL =
  "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FavoriteCompanyButton({
  slug,
  loggedIn,
  className,
}: {
  slug: string;
  loggedIn: boolean;
  className?: string;
}) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    fetch("/api/me/favorite-companies")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d)) setFav(d.some((c: { slug?: string }) => c.slug === slug));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, loggedIn]);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/companies/${slug}`)}`}
        title="관심 기업으로 저장하려면 로그인하세요"
        className={cn(PILL, "border-border text-foreground hover:bg-accent", className)}
      >
        <Star className="h-4 w-4" aria-hidden="true" />
        관심 기업
      </Link>
    );
  }

  async function toggle() {
    const next = !fav;
    setFav(next); // 낙관적
    try {
      const res = await fetch(`/api/me/favorite-companies/${encodeURIComponent(slug)}`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!res.ok) setFav(!next); // 서버 거절 롤백
    } catch {
      setFav(!next); // 롤백
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      title={fav ? "관심 기업 해제" : "관심 기업으로 저장"}
      className={cn(
        PILL,
        fav ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", fav && "fill-current")} aria-hidden="true" />
      {fav ? "관심 기업" : "관심 기업 추가"}
    </button>
  );
}
