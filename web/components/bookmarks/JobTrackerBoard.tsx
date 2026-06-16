"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

// 공고 관리 칸반 — 저장한 공고를 지원 상태별 컬럼으로. 직행 'job-tracker' 참고.
// 카드를 컬럼에 드롭하면 그 컬럼의 대표 상태로 지원 추적(POST /api/me/applications upsert).
// 좌측 '북마크 공고' 풀 = 저장했지만 아직 분류 안 한 공고(드래그 소스 전용 — 언트랙은 v1 미지원).
type Column = {
  key: string;
  label: string;
  statuses: string[]; // 이 컬럼에 묶이는 기존 세부 상태들
  canonical: string; // 이 컬럼에 드롭 시 기록할 대표 상태
  tint: string;
  head: string;
};

const COLUMNS: Column[] = [
  { key: "prep", label: "지원 준비중", statuses: ["interested"], canonical: "interested",
    tint: "bg-surface-2", head: "text-foreground" },
  { key: "applied", label: "지원완료", statuses: ["applied"], canonical: "applied",
    tint: "bg-blue-50 dark:bg-blue-950/30", head: "text-blue-600 dark:text-blue-400" },
  { key: "interview", label: "면접", statuses: ["phone_screen", "take_home", "onsite"], canonical: "onsite",
    tint: "bg-fuchsia-50 dark:bg-fuchsia-950/30", head: "text-fuchsia-600 dark:text-fuchsia-400" },
  { key: "rejected", label: "불합격", statuses: ["rejected"], canonical: "rejected",
    tint: "bg-surface-2", head: "text-muted-foreground" },
  { key: "offer", label: "합격", statuses: ["offer", "accepted"], canonical: "offer",
    tint: "bg-green-50 dark:bg-green-950/30", head: "text-green-600 dark:text-green-400" },
];
const POOL = "pool";

function columnKeyForStatus(status: string | null | undefined): string {
  if (!status) return POOL;
  return COLUMNS.find((c) => c.statuses.includes(status))?.key ?? POOL;
}

export function JobTrackerBoard() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [statusByJob, setStatusByJob] = useState<Record<string, string | null>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/me/saved").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/me/applications").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([saved, apps]) => {
      if (!alive) return;
      setJobs(Array.isArray(saved) ? saved : []);
      const map: Record<string, string | null> = {};
      const items = (apps as { items?: { job_id: string; status: string }[] } | null)?.items;
      if (Array.isArray(items)) for (const a of items) map[a.job_id] = a.status;
      setStatusByJob(map);
    });
    return () => {
      alive = false;
    };
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const jobId = String(e.active.id);
    const overKey = e.over ? String(e.over.id) : null;
    if (!overKey || overKey === POOL) return; // 풀로 되돌리기(언트랙)는 v1 미지원
    const col = COLUMNS.find((c) => c.key === overKey);
    if (!col) return;
    const prev = statusByJob[jobId] ?? null;
    if (columnKeyForStatus(prev) === col.key) return; // 같은 컬럼이면 무시
    setStatusByJob((s) => ({ ...s, [jobId]: col.canonical })); // 낙관적
    fetch("/api/me/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status: col.canonical }),
    })
      .then((r) => {
        if (!r.ok) setStatusByJob((s) => ({ ...s, [jobId]: prev }));
      })
      .catch(() => setStatusByJob((s) => ({ ...s, [jobId]: prev })));
  }

  function removeBookmark(jobId: string) {
    setJobs((js) => (js ? js.filter((j) => j.id !== jobId) : js)); // 낙관적
    fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => {});
  }

  if (jobs === null) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;

  const poolJobs = jobs.filter((j) => columnKeyForStatus(statusByJob[j.id]) === POOL);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* 뷰포트 높이를 채우고(전체 크기), 가로는 항상 맞춰(슬라이드 없음) 카드만 컬럼 내부 스크롤. */}
      <div className="flex h-[calc(100vh-17rem)] gap-2 overflow-x-auto overflow-y-hidden sm:gap-3 md:overflow-x-hidden">
        {/* 북마크 공고 풀 (드래그 소스) */}
        <div className="flex w-52 shrink-0 flex-col">
          <div className="mb-2 px-1 text-body-sm font-semibold">
            북마크 공고 <span className="text-primary">{poolJobs.length}개</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
            <Link
              href="/search"
              className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2.5 text-caption font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> 공고 추가
            </Link>
            {poolJobs.map((j) => (
              <JobChip key={j.id} job={j} onRemove={removeBookmark} />
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <ColumnDrop
            key={col.key}
            col={col}
            jobs={jobs.filter((j) => columnKeyForStatus(statusByJob[j.id]) === col.key)}
            onRemove={removeBookmark}
          />
        ))}
      </div>
    </DndContext>
  );
}

function ColumnDrop({
  col,
  jobs,
  onRemove,
}: {
  col: Column;
  jobs: Job[];
  onRemove: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[14rem] flex-1 flex-col rounded-xl border border-border p-2 md:min-w-0",
        col.tint,
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className={cn("mb-2 flex items-center gap-1.5 px-1 text-body-sm font-semibold", col.head)}>
        {col.label}
        <span className="rounded-full bg-foreground/10 px-1.5 text-caption tabular-nums">{jobs.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
        {jobs.map((j) => (
          <JobChip key={j.id} job={j} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function JobChip({ job, onRemove }: { job: Job; onRemove: (jobId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab touch-none rounded-lg border border-border bg-surface p-3 active:cursor-grabbing",
        isDragging && "opacity-60 shadow-lg ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        aria-label="북마크에서 삭제"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove(job.id);
        }}
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-2 pr-5">
        <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={28} />
        <div className="min-w-0">
          <div className="truncate text-body-sm font-semibold text-foreground">{job.title_ko ?? job.title}</div>
          <div className="truncate text-caption text-muted-foreground">{job.company.display_name}</div>
        </div>
      </div>
    </div>
  );
}
