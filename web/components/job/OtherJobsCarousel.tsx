"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

const PER_PAGE = 4; // 2열 × 2행

// 회사의 다른 공고 — 최대 12개를 페이지당 4개씩 < > 화살표로 넘겨 본다.
export function OtherJobsCarousel({ title, jobs }: { title: string; jobs: Job[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(jobs.length / PER_PAGE);
  const shown = jobs.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {pages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="이전 공고"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-caption tabular-nums text-muted-foreground">
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
              aria-label="다음 공고"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}
