"use client";

import { Globe, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// 전역 헤더. 직무(discipline) 스위처는 헤더에 두되, 비자 트랙(이주/원격/둘다)은 랜딩 히어로와
// /search 필터에 있으므로 헤더에는 두지 않는다. "이력서 코치"는 로그인 시 동작(게스트는 로그인 유도).
const NAV_LINKS = [
  { href: "/search", label: "검색" },
  { href: "/recent", label: "최근 공고" },
  { href: "/recommend", label: "추천" },
  { href: "/companies", label: "회사" },
  { href: "/community", label: "커뮤니티" },
  { href: "/me/coach", label: "이력서 코치" },
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
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-4 py-3">
        {/* 좌측: 로고 + 데스크톱 링크 */}
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">
              World<span className="text-primary">Dev</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-body-sm md:flex">
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
          </nav>
        </div>

        {/* 우측: 테마 + 계정/CTA */}
        <div className="flex items-center gap-2">
          {loggedIn && <NotificationBell />}
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            <AccountMenu loggedIn={loggedIn} />
            {!loggedIn && (
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-body-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                시작하기
              </Link>
            )}
          </div>

          {/* 모바일 메뉴 */}
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
              <Menu className="h-5 w-5" aria-hidden="true" />
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
                  <>
                    <Link
                      href="/signin"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/signup"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="mt-1 block rounded-md bg-primary px-3 py-2 text-center text-body-sm font-bold text-primary-foreground"
                    >
                      시작하기
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
