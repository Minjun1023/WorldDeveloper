"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 헤더 북마크 드롭다운 — 저장한 공고 / 관심 기업 / 최근 본 공고로 이동.
// 클릭 토글 + 바깥 클릭 닫힘(AccountMenu 패턴 동일). 모두 공개 라우트(로그인 시 내용 채워짐).
const ITEMS = [
  { href: "/bookmarks/saved", label: "저장한 공고" },
  { href: "/bookmarks/companies", label: "관심 기업" },
  { href: "/recent", label: "최근 본 공고" },
];

export function BookmarkMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="북마크"
        aria-expanded={open}
        title="저장한 공고·관심 기업·최근 본 공고"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-body-sm hover:bg-muted"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
