"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// 전역 헤더는 페이지 이동용 보조 내비. 트랙(이주/원격/둘다) 선택은 랜딩 히어로와 /search 필터에
// 있으므로 헤더에는 두지 않는다. 사용자 전용 "내 지원"은 계정 메뉴(로그인 시)에만.
const NAV_LINKS = [
  { href: "/search", label: "검색" },
  { href: "/recommend", label: "AI 추천" },
  { href: "/companies", label: "회사" },
  { href: "/about", label: "소개" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

export function SiteNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = useIsActive();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav className="hidden items-center gap-3 text-body-sm md:flex">
        {NAV_LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "transition-colors",
                active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
        <AccountMenu loggedIn={loggedIn} />
        <ThemeToggle />
      </nav>

      <div ref={ref} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label="메뉴"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {open && (
          <div
            id="mobile-nav"
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg"
          >
            {NAV_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-md px-3 py-2 text-body-sm hover:bg-muted",
                    active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}

            <div className="my-1.5 border-t border-border" />
            {loggedIn ? (
              <>
                <Link
                  href="/me/applications"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  내 지원
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="block w-full rounded-md px-3 py-2 text-left text-body-sm text-destructive hover:bg-muted"
                  >
                    로그아웃
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/signin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                로그인
              </Link>
            )}
            <div className="flex items-center justify-between px-3 py-2 text-body-sm text-muted-foreground">
              <span>테마</span>
              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
