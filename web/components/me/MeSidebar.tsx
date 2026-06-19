"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// 내 페이지: 프로필.
// (지원 현황은 /bookmarks 공고관리 칸반으로 일원화, 저장·관심·최근 본 공고도 헤더 북마크로 분리됨)
const ITEMS = [
  { href: "/me/profile", label: "프로필", icon: User },
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
