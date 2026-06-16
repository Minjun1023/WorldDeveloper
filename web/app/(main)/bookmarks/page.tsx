"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SavedJobsList } from "@/components/saved/SavedJobsList";
import { postedRelativeLabel } from "@/lib/jobDates";
import { getRecentJobs, type RecentJob } from "@/lib/recent";

// 북마크 허브(공개) — 저장한 공고(로그인 필요) + 최근 본 공고(localStorage, 로그인 불필요)를 한 페이지에.
// /me/* 는 로그인 리다이렉트 게이트라 공개 라우트로 둔다(미로그인도 최근 본 공고는 보임).
export default function BookmarksPage() {
  const [recent, setRecent] = useState<RecentJob[] | null>(null); // null=하이드레이션 전

  useEffect(() => setRecent(getRecentJobs()), []);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">북마크</h1>
        <p className="mt-2 text-muted-foreground">저장한 공고와 최근 본 공고를 모아둔 곳이에요.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">저장한 공고</h2>
        <SavedJobsList />
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">최근 본 공고</h2>
        {recent === null ? null : recent.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-body-sm text-muted-foreground">아직 열어본 공고가 없어요.</p>
            <Link href="/search" className="mt-3 inline-block text-body-sm text-primary">
              공고 둘러보러 가기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${encodeURIComponent(j.id)}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CompanyLogo slug={j.slug} name={j.company} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-sm font-semibold text-foreground group-hover:text-primary">
                    {j.title}
                  </div>
                  <div className="truncate text-caption text-muted-foreground">{j.company}</div>
                </div>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {postedRelativeLabel(new Date(j.ts).toISOString()) ?? ""} 봄
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
