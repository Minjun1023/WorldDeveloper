"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

export function SavedJobsList() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch("/api/me/saved")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Job[]) => setJobs(d))
      .catch(() => setJobs([]));
  }, []);

  if (jobs === null) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-body-sm text-muted-foreground">아직 저장한 공고가 없어요.</p>
        <Link href="/recommend" className="mt-3 inline-block text-body-sm text-primary">맞춤 추천 보러 가기 →</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
