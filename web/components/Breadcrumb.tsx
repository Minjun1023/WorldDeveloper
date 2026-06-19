"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 내비바 페이지 헤더 브레드크럼: "홈 > 섹션". 두 항목 모두 클릭 시 해당 페이지로 이동.
// 매핑되지 않은 경로(또는 홈)에서는 표시하지 않는다.
const SECTIONS: Record<string, { label: string; href: string }> = {
  search: { label: "공고 검색", href: "/search" },
  recommend: { label: "맞춤 추천", href: "/recommend" },
  bookmarks: { label: "북마크", href: "/bookmarks" },
  community: { label: "커뮤니티", href: "/community" },
  companies: { label: "기업", href: "/companies" },
  coach: { label: "이력서 코치", href: "/coach" },
  jobs: { label: "공고", href: "/search" },
  visa: { label: "비자 가이드", href: "/visa" },
  me: { label: "내 정보", href: "/me/profile" },
  recent: { label: "최근 본 공고", href: "/recent" },
  contact: { label: "문의", href: "/contact" },
};

export function Breadcrumb() {
  const pathname = usePathname();
  const seg = pathname.split("/").filter(Boolean)[0];
  const section = seg ? SECTIONS[seg] : undefined;
  if (!section) return null;

  return (
    <nav aria-label="현재 위치" className="mb-4 flex items-center gap-1.5 text-body-sm">
      <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
        홈
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <Link href={section.href} className="font-medium text-foreground transition-colors hover:text-primary">
        {section.label}
      </Link>
    </nav>
  );
}
