"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// 관심 기업(즐겨찾기) 토글 — 회사 상세 히어로용 별 아이콘 버튼(라벨 없이 아이콘만).
// 기존 /api/me/favorite-companies PUT/DELETE 재사용. 초기 상태는 목록 1회 조회로 동기화.
// 낙관적 토글 + 실패 시 롤백. 로그아웃 시 로그인 유도 링크. 의미는 aria-label/title 로 제공.
// 테두리 없이 별 아이콘만(요청). 호버 시 은은한 배경으로 클릭 affordance 만 준다.
const ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FavoriteCompanyButton({
  slug,
  loggedIn,
  initialFav,
  className,
}: {
  slug: string;
  loggedIn: boolean;
  // 초기 관심 여부. 제공되면(목록처럼 부모가 한 번에 조회) mount 시 자체 fetch 를 생략한다.
  initialFav?: boolean;
  className?: string;
}) {
  const [fav, setFav] = useState(initialFav ?? false);

  useEffect(() => {
    if (!loggedIn || initialFav !== undefined) return;
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
  }, [slug, loggedIn, initialFav]);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/companies/${slug}`)}`}
        aria-label="관심 기업"
        title="관심 기업으로 저장하려면 로그인하세요"
        className={cn(ICON_BTN, "text-muted-foreground hover:bg-accent hover:text-foreground", className)}
      >
        <Star className="h-5 w-5" aria-hidden="true" />
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
      aria-label={fav ? "관심 기업 해제" : "관심 기업으로 저장"}
      title={fav ? "관심 기업 해제" : "관심 기업으로 저장"}
      className={cn(
        ICON_BTN,
        fav ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-5 w-5", fav && "fill-current")} aria-hidden="true" />
    </button>
  );
}
