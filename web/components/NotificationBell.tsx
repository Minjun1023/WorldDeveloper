"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// 헤더 알림벨: 저장 검색의 "마지막으로 본 이후 새 공고" 합계를 배지로. 클릭 → /me/searches.
// 베스트 에포트(실패해도 벨은 링크로 동작). 백엔드 변경 없음(/api/me/searches 의 newCount 재사용).
export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/searches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !Array.isArray(d)) return;
        const total = d.reduce((s: number, it: { newCount?: number }) => s + (it.newCount ?? 0), 0);
        setCount(total);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const label = count > 0 ? `저장 검색 새 공고 ${count}건` : "저장 검색 알림";

  return (
    <Link
      href="/me/searches"
      aria-label={label}
      title={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
