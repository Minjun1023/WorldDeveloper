"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { getRecentJobs, type RecentJob } from "@/lib/recent";

// 최근 본 공고 — 상세를 열어본 공고를 가로 스크롤 카드로. 비어있으면 렌더 안 함.
export function RecentJobs() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);

  useEffect(() => setJobs(getRecentJobs()), []);

  if (jobs.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-body-sm font-semibold text-muted-foreground">최근 본 공고</h2>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {jobs.map((j) => (
          <Link
            key={j.id}
            href={`/jobs/${encodeURIComponent(j.id)}`}
            className="group flex w-56 shrink-0 items-center gap-2.5 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CompanyLogo slug={j.slug} name={j.company} size={32} />
            <div className="min-w-0">
              <div className="truncate text-body-sm font-semibold text-foreground group-hover:text-primary">{j.title}</div>
              <div className="truncate text-caption text-muted-foreground">{j.company}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
