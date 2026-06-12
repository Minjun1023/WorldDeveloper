"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { SectionHeader } from "@/components/home/SectionHeader";
import { getRecentJobs, type RecentJob } from "@/lib/recent";

// 최근 본 공고 — 상세를 열어본 공고를 랜딩 전폭 섹션의 가로 스크롤 카드로.
// localStorage 기반이라 클라이언트에서만 채워지며, 비어있으면(신규 방문자) 섹션 전체를 렌더하지 않는다.
export function RecentJobs() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);

  useEffect(() => setJobs(getRecentJobs()), []);

  if (jobs.length === 0) return null;

  return (
    <section>
      <div className="mx-auto max-w-container px-4 py-14 sm:py-20">
        <SectionHeader overline="이어 보기" title="최근 본 공고" />
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
      </div>
    </section>
  );
}
