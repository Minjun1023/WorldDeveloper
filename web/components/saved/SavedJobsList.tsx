"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AlertToggleCard } from "@/components/alerts/AlertToggleCard";
import { JobCard } from "@/components/job/JobCard";
import { LoadError } from "@/components/ui/LoadError";
import type { Job } from "@/lib/types";

export function SavedJobsList() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setJobs(null);
    setError(false);
    fetch("/api/me/saved")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: Job[]) => alive && setJobs(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (error) {
    return <LoadError message="저장한 공고를 불러오지 못했어요" onRetry={() => setReloadKey((k) => k + 1)} />;
  }
  if (jobs === null) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">아직 저장한 공고가 없어요.</p>
        <Link href="/recommend" className="mt-3 inline-block text-body-sm text-primary">맞춤 추천 보러 가기 →</Link>
      </div>
    );
  }
  return (
    <div>
      <AlertToggleCard
        endpoint="/api/me/saved-job-alerts"
        title="마감 이메일 알림"
        description="저장한 공고가 마감되면 이메일로 알려드려요. 헛지원을 막아드립니다."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
