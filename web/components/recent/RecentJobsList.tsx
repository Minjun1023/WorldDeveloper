"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Button, buttonVariants } from "@/components/ui/button";
import { viewedAgoLabel } from "@/lib/jobDates";
import { clearRecentJobs, getRecentJobs, type RecentJob } from "@/lib/recent";
import { cn } from "@/lib/utils";

// 최근 본 공고 목록.
// - serverJobs !== null: 로그인 유저 → 계정 기준 서버 기록(job_views)을 그대로 표시. 기기 무관·기록 지우기 없음.
// - serverJobs === null: 비로그인 → 기존처럼 localStorage(기기 로컬) 기록 + 기록 지우기.
export function RecentJobsList({ serverJobs }: { serverJobs: RecentJob[] | null }) {
  const isServer = serverJobs !== null;
  // 서버 모드는 초기값을 확정(하이드레이션 깜빡임 없음), 로컬 모드는 effect 후 채움(null=로딩).
  const [localJobs, setLocalJobs] = useState<RecentJob[] | null>(null);

  useEffect(() => {
    if (!isServer) setLocalJobs(getRecentJobs());
  }, [isServer]);

  const jobs = isServer ? serverJobs : localJobs;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">최근 본 공고</h1>
        {!isServer && jobs && jobs.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              clearRecentJobs();
              setLocalJobs([]);
            }}
            className="shrink-0"
          >
            기록 지우기
          </Button>
        )}
      </section>

      {jobs === null ? null : jobs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-body-sm text-muted-foreground">아직 열어본 공고가 없어요.</p>
          <Link href="/search" className={cn(buttonVariants(), "mt-3")}>
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
              <span className="shrink-0 text-caption text-muted-foreground">{viewedAgoLabel(j.ts)}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
