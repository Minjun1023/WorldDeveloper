"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/BrandMark";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 전역 헤더 — Figma 디자인(table-fax-94005204.figma.site)의 내비를 그대로 반영.
// 평면 상위 링크 + 테마 토글 + (비로그인) 로그인·회원가입 / (로그인) 계정 메뉴.
// Figma 의 "비로그인" 토글은 목업 전용 데모라 제외한다.
const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/search", label: "공고 검색" },
  // 맞춤 추천: 홈 랜딩 캐러셀이 전체 추천을 담당하게 되어 내비에서 내림(라우트는 유지).
  { href: "/bookmarks", label: "북마크" },
  { href: "/companies", label: "기업" },
  { href: "/visa", label: "비자 가이드" },
  { href: "/coach", label: "이력서 코치" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
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
        {/* 좌측: 로고 + 데스크톱 평면 링크 */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
              <BrandMark className="h-[16px] w-[16px]" />
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              Dev<span className="text-primary">Pass</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-[13px] md:flex">
            {NAV_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors",
                    active
                      ? "bg-accent font-semibold text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 우측: 테마 토글 + 계정/CTA */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            {loggedIn ? (
              <AccountMenu loggedIn />
            ) : (
              <>
                <Link href="/signin" className={cn(buttonVariants({ variant: "outline" }))}>
                  로그인
                </Link>
                <Link href="/signup" className={cn(buttonVariants())}>
                  회원가입
                </Link>
              </>
            )}
          </div>

          {/* 모바일 메뉴 */}
          <div ref={ref} className="relative md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label="메뉴"
              className="[&_svg]:size-5"
            >
              <Menu aria-hidden="true" />
            </Button>
            {/* 스크림 — 메뉴 열림 상태를 시각적으로 분명히 하고 바깥 탭으로 닫기 */}
            {open && (
              <div
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
            )}
            {open && (
              <div
                id="mobile-nav"
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
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
                      href="/me/profile"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      프로필 정보
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
                      className={cn(buttonVariants(), "mt-1 w-full")}
                    >
                      회원가입
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
