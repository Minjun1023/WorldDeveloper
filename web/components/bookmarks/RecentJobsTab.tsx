"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { postedRelativeLabel } from "@/lib/jobDates";
import { getRecentJobs, type RecentJob } from "@/lib/recent";

// 최근 본 공고 탭 — 열람 기록(localStorage)을 카드 그리드로. 직행 'bookmark/recent' 참고.
export function RecentJobsTab() {
  const [jobs, setJobs] = useState<RecentJob[] | null>(null);

  useEffect(() => setJobs(getRecentJobs()), []);

  if (jobs === null) return null;
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-body-sm text-muted-foreground">아직 열어본 공고가 없어요.</p>
        <Link href="/search" className="mt-3 inline-block text-body-sm text-primary">
          공고 둘러보러 가기 →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {jobs.map((j) => (
        <Link
          key={j.id}
          href={`/jobs/${encodeURIComponent(j.id)}`}
          className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CompanyLogo slug={j.slug} name={j.company} size={36} />
          <div className="min-w-0">
            <div className="line-clamp-2 text-body-sm font-semibold text-foreground group-hover:text-primary">
              {j.title}
            </div>
            <div className="mt-0.5 truncate text-caption text-muted-foreground">{j.company}</div>
          </div>
          <div className="mt-auto text-caption text-muted-foreground">
            {postedRelativeLabel(new Date(j.ts).toISOString()) ?? ""} 봄
          </div>
        </Link>
      ))}
    </div>
  );
}
