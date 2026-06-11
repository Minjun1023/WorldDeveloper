"use client";

import { Bell, Bookmark, FileText, ListChecks, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Counts = { saved: number | null; searches: number | null; newJobs: number | null; applications: number | null };

// 내 활동 허브: 기존 /api/me/* 를 병렬 조회(베스트 에포트 — 실패 시 카운트만 숨김, 링크는 항상 동작).
export default function MeHomePage() {
  const [c, setC] = useState<Counts>({ saved: null, searches: null, newJobs: null, applications: null });

  useEffect(() => {
    fetch("/api/me/interactions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Array.isArray(d?.saved) && setC((x) => ({ ...x, saved: d.saved.length })))
      .catch(() => {});
    fetch("/api/me/searches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!Array.isArray(d)) return;
        const newJobs = d.reduce((s: number, it: { newCount?: number }) => s + (it.newCount ?? 0), 0);
        setC((x) => ({ ...x, searches: d.length, newJobs }));
      })
      .catch(() => {});
    fetch("/api/me/applications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Array.isArray(d?.items) && setC((x) => ({ ...x, applications: d.items.length })))
      .catch(() => {});
  }, []);

  const cards = [
    { href: "/me/saved", icon: Bookmark, title: "저장한 공고", desc: "다시 볼 공고 모음",
      count: c.saved, badge: null as string | null },
    { href: "/me/searches", icon: Bell, title: "저장 검색", desc: "조건에 맞는 새 공고 확인",
      count: c.searches, badge: c.newJobs ? `새 공고 ${c.newJobs}건` : null },
    { href: "/me/applications", icon: ListChecks, title: "지원 현황", desc: "지원한 공고 진행 상태",
      count: c.applications, badge: null },
    { href: "/me/coach", icon: FileText, title: "이력서 코치", desc: "공고 기반 1:1 이력서 상담",
      count: null, badge: null },
    { href: "/me/profile", icon: User, title: "프로필", desc: "추천 정확도를 높이는 기본 정보",
      count: null, badge: null },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h2">내 활동</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">저장·알림·지원 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, desc, count, badge }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground group-hover:text-primary">{title}</span>
                {count !== null && (
                  <span className="rounded-lg bg-surface-2 px-1.5 py-0.5 text-caption font-semibold tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
                {badge && (
                  <span className="rounded-lg bg-primary/10 px-1.5 py-0.5 text-caption font-semibold text-primary">
                    {badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-body-sm text-muted-foreground">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
