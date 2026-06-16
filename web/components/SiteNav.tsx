"use client";

import { ChevronDown, Globe, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// 전역 헤더. 공고를 찾는 동선(검색·추천·회사)은 "채용" 드롭다운으로 묶고,
// 커뮤니티·이력서 코치는 최상위에 둔다. "최근 본 공고"는 개인 열람 이력이라
// 로그인 계정 메뉴(내 활동)에 두고, 모바일 메뉴/랜딩에서는 게스트도 접근 가능하다.
const JOBS_ITEMS = [
  { href: "/search", label: "검색" },
  { href: "/recommend", label: "추천" },
  { href: "/companies", label: "기업" },
];

const TOP_LINKS = [
  { href: "/community", label: "커뮤니티" },
  { href: "/coach", label: "이력서 코치" },
];

const RECENT_LINK = { href: "/recent", label: "최근 본 공고" };

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

// 데스크톱 "채용" 드롭다운: 클릭 토글 + 바깥클릭/Esc 닫힘. 하위 항목이 활성이면 채용도 활성 표시.
function JobsDropdown({ isActive }: { isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = JOBS_ITEMS.some((l) => isActive(l.href));

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1 transition-colors",
          groupActive || open ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        채용
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {JOBS_ITEMS.map((l) => {
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
        </div>
      )}
    </div>
  );
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
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
              <Globe className="h-[16px] w-[16px]" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              World<span className="text-primary">Dev</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-4 text-[13px] md:flex">
            <JobsDropdown isActive={isActive} />
            {TOP_LINKS.map((l) => {
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
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            <AccountMenu loggedIn={loggedIn} />
            {!loggedIn && (
              <Link
                href="/signup"
                className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
                <p className="px-3 pb-1 pt-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
                  채용
                </p>
                {JOBS_ITEMS.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-md py-2 pl-5 pr-3 text-body-sm hover:bg-muted",
                        active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {l.label}
                    </Link>
                  );
                })}

                <div className="my-1.5 border-t border-border" />
                {[...TOP_LINKS, RECENT_LINK].map((l) => {
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
