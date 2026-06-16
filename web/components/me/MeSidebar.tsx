"use client";

import { Bookmark, ListChecks, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// 순서는 헤더 계정 드롭다운(AccountMenu)과 동일하게 유지:
// 프로필 → 지원 현황 → 저장한 공고. (이력서 코치는 /coach 독립 페이지로 분리됨)
const ITEMS = [
  { href: "/me/profile", label: "프로필", icon: User },
  { href: "/me/applications", label: "지원 현황", icon: ListChecks },
  { href: "/me/saved", label: "저장한 공고", icon: Bookmark },
];

export function MeSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="내 페이지" className="lg:w-52 lg:shrink-0">
      <p className="mb-2 hidden px-3 text-caption font-medium uppercase tracking-wide text-muted-foreground lg:block">
        내 페이지
      </p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-body-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
