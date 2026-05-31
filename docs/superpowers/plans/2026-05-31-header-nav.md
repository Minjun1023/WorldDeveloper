# 헤더 개선 구현 플랜 — 계정 드롭다운 + 모바일 햄버거

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전역 헤더에 계정 메뉴 드롭다운(로그인 시 아바타→내 지원/로그아웃)과 모바일 햄버거 메뉴를 추가. 데스크톱 외형 유지.

**Architecture:** `layout.tsx`(서버)가 세션으로 `loggedIn` 판별 → 클라이언트 `SiteNav`(데스크톱 가로 nav + 모바일 햄버거 + `AccountMenu` + `ThemeToggle`). 백엔드 무변경.

**Tech Stack:** Next.js 14 App Router / React(client components) / TS / Tailwind. 검증: `npx tsc --noEmit` + 라이브 비주얼.

설계 전문: `docs/superpowers/specs/2026-05-31-header-nav-design.md`.

> 명령은 `web/`에서. Tailwind 클래스(bg-surface/bg-muted/border-border/text-primary-foreground/text-destructive 등)는 프로젝트에서 사용 중. 작업 순서: AccountMenu → SiteNav → layout(+UserMenu 삭제) → 검증.

---

## File Structure
- Create: `web/components/auth/AccountMenu.tsx` (client) — 계정 드롭다운/로그인 링크.
- Create: `web/components/SiteNav.tsx` (client) — 데스크톱 nav + 모바일 햄버거(AccountMenu+ThemeToggle 포함).
- Modify: `web/app/layout.tsx` — async + getSession + `<SiteNav loggedIn>`; UserMenu/ThemeToggle import 제거.
- Delete: `web/components/auth/UserMenu.tsx` (AccountMenu로 완전 대체).

---

### Task 1: AccountMenu

**Files:** Create `web/components/auth/AccountMenu.tsx`

- [ ] **Step 1: 구현**
```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function AccountMenu({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (!loggedIn) {
    return (
      <Link href="/signin" className="hover:text-foreground transition-colors">
        로그인
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
          <Link
            href="/me/applications"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-body-sm hover:bg-muted"
          >
            내 지원
          </Link>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-md px-3 py-2 text-left text-body-sm text-destructive hover:bg-muted"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크** — `cd web && npx tsc --noEmit` (node_modules 없으면 `npm install` 먼저) → 에러 없음.
- [ ] **Step 3: 커밋**
```bash
git add web/components/auth/AccountMenu.tsx
git commit -m "feat(web): AccountMenu 계정 드롭다운(로그인 시 내 지원/로그아웃)"
```

---

### Task 2: SiteNav

**Files:** Create `web/components/SiteNav.tsx`

- [ ] **Step 1: 구현**
```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "/search", label: "검색" },
  { href: "/recommend", label: "추천" },
  { href: "/companies", label: "회사" },
  { href: "/me/applications", label: "내 지원" },
  { href: "/about", label: "소개" },
];

export function SiteNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <nav className="hidden items-center gap-3 text-body-sm text-muted-foreground md:flex">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
            {l.label}
          </Link>
        ))}
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
            className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-surface p-2 shadow-lg"
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            {loggedIn ? (
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="block w-full rounded-md px-3 py-2 text-left text-body-sm text-destructive hover:bg-muted"
                >
                  로그아웃
                </button>
              </form>
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
```

- [ ] **Step 2: 타입체크** — `cd web && npx tsc --noEmit` → 에러 없음.
- [ ] **Step 3: 커밋**
```bash
git add web/components/SiteNav.tsx
git commit -m "feat(web): SiteNav 반응형 헤더(데스크톱 nav + 모바일 햄버거)"
```

---

### Task 3: layout.tsx 적용 + UserMenu 삭제

**Files:** Modify `web/app/layout.tsx`, Delete `web/components/auth/UserMenu.tsx`

- [ ] **Step 1: layout.tsx 교체**

import 블록 교체(UserMenu·ThemeToggle 제거, SiteNav·getSession 추가):
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNav } from "@/components/SiteNav";
import { getSession } from "@/lib/session-server";
```
RootLayout을 async로 + 세션 읽기:
```tsx
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
```
헤더의 `<nav>...</nav>` 블록(기존 인라인 링크 + UserMenu + ThemeToggle, 현재 31~39행) 전체를 다음으로 교체:
```tsx
              <SiteNav loggedIn={!!session} />
```
(즉 `<div className="...flex items-center justify-between">` 안의 `<a href="/">WorldDeveloper</a>` 다음 `<nav>` 전체 → `<SiteNav loggedIn={!!session} />`.)

- [ ] **Step 2: UserMenu 삭제**
```bash
git rm web/components/auth/UserMenu.tsx
```
(layout 외 참조 없음 — Task 시작 시 `grep -rn "UserMenu" web` 으로 확인, layout만 나와야 함.)

- [ ] **Step 3: 타입체크** — `cd web && npx tsc --noEmit` → 에러 없음.

- [ ] **Step 4: 커밋**
```bash
git add web/app/layout.tsx web/components/auth/UserMenu.tsx
git commit -m "feat(web): 헤더 SiteNav 적용(세션 loggedIn 주입) + UserMenu 제거"
```

---

### Task 4: 라이브 비주얼 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 타입체크 최종** — `cd web && npx tsc --noEmit`. lint 있으면 `npm run lint`.
- [ ] **Step 2: dev 스택** — worktree web 별도 포트: `cd web && PORT=3001 BACKEND_URL=http://localhost:8080 npm run dev`. 백엔드(:8080) 가동 확인.
- [ ] **Step 3: Playwright 확인**
  - 데스크톱 폭(기본 ~1200): 가로 nav(검색~소개) + 비로그인 "로그인" + 테마 보임. 햄버거 안 보임.
  - 모바일 폭(`browser_resize` width≈375): 가로 nav 숨고 ☰ 보임 → ☰ 클릭 → 드롭다운 패널에 5개 링크 + 로그인 + 테마 표시 → 바깥 클릭/링크 클릭 시 닫힘.
  - (로그인 상태: 세션 쿠키 있으면 아바타→드롭다운(내 지원/로그아웃) 확인. 없으면 비로그인 경로 + 코드 확인으로 갈음.)
  - DOM eval: 모바일에서 ☰ 버튼 존재, 열림 시 "내 지원"/"소개"/"로그인" 텍스트 노출. 스크린샷.
- [ ] **Step 4: 보고** — 스크린샷 + 동작 요약. 커밋 없음.

> 라이브 스택 미가동 시 Step 1 타입체크까지만, 비주얼은 머지 후로.

---

## Self-Review
- **Spec coverage:** §4.1 AccountMenu → Task 1. §4.2 SiteNav → Task 2. §4.3 layout(+UserMenu 삭제) → Task 3. §6 검증 → Task 4. 누락 없음.
- **Placeholder scan:** TBD/TODO 없음. 모든 스텝 실제 코드/정확한 교체 지점.
- **Type consistency:** `AccountMenu({loggedIn:boolean})`(Task1) ↔ SiteNav에서 `<AccountMenu loggedIn={loggedIn}/>`(Task2). `SiteNav({loggedIn:boolean})`(Task2) ↔ layout `<SiteNav loggedIn={!!session}/>`(Task3). `getSession(): Promise<Session|null>` → `!!session` boolean. ThemeToggle는 SiteNav가 사용(layout에서 제거). 로그아웃 form action `/api/auth/logout`(기존 UserMenu와 동일). 로그인 링크 `/signin`(기존과 동일).
- **주의:** RootLayout이 `getSession()`(cookies 사용)으로 동적 렌더가 될 수 있으나, 앱이 이미 인증 쿠키 기반이라 허용 범위.
