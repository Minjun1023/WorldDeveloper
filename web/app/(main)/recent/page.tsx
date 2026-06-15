"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { postedRelativeLabel } from "@/lib/jobDates";
import { clearRecentJobs, getRecentJobs, type RecentJob } from "@/lib/recent";

// 최근 본(열람한) 공고 — 상세를 열어본 공고를 기기 로컬(localStorage)에 기록한 목록.
// 로그인 불필요·서버 무관(브라우징 기록). 비어있으면 안내.
export default function RecentPage() {
  const [jobs, setJobs] = useState<RecentJob[] | null>(null); // null=하이드레이션 전

  useEffect(() => setJobs(getRecentJobs()), []);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display">최근 본 공고</h1>
          <p className="mt-2 text-muted-foreground">
            상세를 열어본 공고를 이 기기에 기록해 다시 찾기 쉽게 모았어요. (로그인 불필요)
          </p>
        </div>
        {jobs && jobs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearRecentJobs();
              setJobs([]);
            }}
            className="shrink-0 rounded-md px-3 py-1.5 text-body-sm text-muted-foreground hover:text-destructive"
          >
            기록 지우기
          </button>
        )}
      </section>

      {jobs === null ? null : jobs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-body-sm text-muted-foreground">아직 열어본 공고가 없어요.</p>
          <Link
            href="/search"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground"
          >
            공고 둘러보기
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          {jobs.map((j) => (
            <Link
              key={j.id}
              href={`/jobs/${encodeURIComponent(j.id)}`}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CompanyLogo slug={j.slug} name={j.company} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-bold text-foreground group-hover:text-primary">{j.title}</div>
                <div className="truncate text-body-sm text-muted-foreground">{j.company}</div>
              </div>
              <span className="shrink-0 text-caption text-muted-foreground">
                {postedRelativeLabel(new Date(j.ts).toISOString()) ?? ""} 봄
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
