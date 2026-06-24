"use client";

import { Star } from "lucide-react";
import Link from "next/link";

import { useFavoriteCompany } from "@/lib/favorite-companies";
import { cn } from "@/lib/utils";

// 관심 기업(즐겨찾기) 토글 — 별 아이콘 버튼(라벨 없이 아이콘만, 테두리 없음).
// 상태는 favorite-companies 모듈 스토어가 단일 소스 → 목록/상세 어디서 토글하든 즉시 동기화되고,
// 클라이언트 내비게이션(목록→상세→목록) 동안 유지돼 '돌아오면 ★ 가 풀리는' 현상이 없다.
// 로그아웃 시 로그인 유도 링크. 의미는 aria-label/title 로 제공.
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
  // 초기 관심 여부(서버 렌더). 스토어 로드 전 첫 렌더 표시에만 쓰이고, 이후엔 스토어가 단일 소스.
  initialFav?: boolean;
  className?: string;
}) {
  const { fav, toggle } = useFavoriteCompany(slug, loggedIn, initialFav ?? false);

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
