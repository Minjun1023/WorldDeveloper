"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 내비바 페이지 헤더 브레드크럼: "홈 > 섹션 (> 상세)". 상세 페이지(하위 세그먼트 존재)면
// leaf 라벨을 현재 위치로 덧붙인다. 매핑되지 않은 경로(또는 홈)에서는 표시하지 않는다.
const SECTIONS: Record<string, { label: string; href: string; leaf?: string }> = {
  search: { label: "공고 검색", href: "/search" },
  recommend: { label: "맞춤 추천", href: "/recommend" },
  bookmarks: { label: "북마크", href: "/bookmarks" },
  community: { label: "커뮤니티", href: "/community" },
  companies: { label: "기업", href: "/companies", leaf: "기업 상세" },
  coach: { label: "이력서 코치", href: "/coach" },
  jobs: { label: "공고", href: "/search", leaf: "공고 상세" },
  visa: { label: "비자 가이드", href: "/visa", leaf: "국가 가이드" },
  me: { label: "프로필 정보", href: "/me/profile" },
  recent: { label: "최근 본 공고", href: "/recent" },
  contact: { label: "문의", href: "/contact" },
  terms: { label: "이용약관", href: "/terms" },
  privacy: { label: "개인정보처리방침", href: "/privacy" },
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  const section = segs[0] ? SECTIONS[segs[0]] : undefined;
  if (!section) return null;
  // 하위 세그먼트가 있으면 상세 페이지 → leaf 라벨을 현재 위치로 붙인다.
  const leaf = segs.length > 1 ? section.leaf : undefined;

  return (
    <nav aria-label="현재 위치" className="mb-4 flex items-center gap-1.5 text-body-sm">
      <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
        홈
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <Link
        href={section.href}
        className={
          leaf
            ? "text-muted-foreground transition-colors hover:text-foreground"
            : "font-medium text-foreground transition-colors hover:text-primary"
        }
      >
        {section.label}
      </Link>
      {leaf && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground" aria-current="page">
            {leaf}
          </span>
        </>
      )}
    </nav>
  );
}
