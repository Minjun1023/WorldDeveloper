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
        <div role="menu" className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
          <Link
            href="/me/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-body-sm hover:bg-muted"
          >
            프로필 정보
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
