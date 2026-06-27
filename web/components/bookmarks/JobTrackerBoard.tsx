"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { MessageSquareText, Plus, X } from "lucide-react";
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
  // 드래그 중인 공고 id — DragOverlay(포털)로 떠 있는 카드를 그린다. overflow 클리핑을 벗어나기 위함.
  const [activeId, setActiveId] = useState<string | null>(null);
  // 포인터(마우스/터치) + 키보드 둘 다 지원 — 키보드 사용자도 Space 로 집고 방향키로
  // 컬럼 이동, Space 로 드롭(지원 상태 변경) 가능. dnd-kit 이 스크린리더 안내도 제공.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

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
    setActiveId(null);
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
  const activeJob = activeId ? (jobs.find((j) => j.id === activeId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* 뷰포트 높이를 채우고(전체 크기), 가로는 항상 맞춰(슬라이드 없음) 카드만 컬럼 내부 스크롤. */}
      <div className="flex h-[calc(100dvh-17rem)] gap-2 overflow-x-auto overflow-y-hidden sm:gap-3 md:overflow-x-hidden">
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
              <JobChip key={j.id} job={j} onRemove={removeBookmark} columnKey={POOL} />
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

      {/* 드래그 중 카드는 포털로 body 레벨에 떠서 그려진다 — 컬럼/보드의 overflow 클리핑을 벗어난다. */}
      <DragOverlay dropAnimation={null}>
        {activeJob ? <CardSurface job={activeJob} dragging /> : null}
      </DragOverlay>
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
          <JobChip key={j.id} job={j} onRemove={onRemove} columnKey={col.key} />
        ))}
      </div>
    </div>
  );
}

// 카드 외곽 공통 스타일 — 제자리 카드(JobChip)와 드래그 오버레이(CardSurface)가 동일하게 쓴다.
const CARD_CHROME = "rounded-lg border border-border bg-surface p-3";

function CardContent({ job }: { job: Job }) {
  return (
    <div className="flex items-center gap-2 pr-5">
      <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={28} />
      <div className="min-w-0">
        <div className="truncate text-body-sm font-semibold text-foreground">{job.title_ko ?? job.title}</div>
        <div className="truncate text-caption text-muted-foreground">{job.company.display_name}</div>
      </div>
    </div>
  );
}

// DragOverlay(포털)에 떠서 그려지는 카드. dnd-kit 이 원본 노드 크기에 맞춰 래퍼 폭을 잡아준다.
function CardSurface({ job, dragging }: { job: Job; dragging?: boolean }) {
  return (
    <div className={cn(CARD_CHROME, dragging && "cursor-grabbing shadow-lg ring-2 ring-primary")}>
      <CardContent job={job} />
    </div>
  );
}

function JobChip({
  job,
  onRemove,
  columnKey,
}: {
  job: Job;
  onRemove: (jobId: string) => void;
  columnKey: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab touch-none active:cursor-grabbing",
        CARD_CHROME,
        // 원본은 흐리게만 — 실제 움직이는 카드는 DragOverlay 가 그린다(overflow 클리핑 회피).
        isDragging && "opacity-40",
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
      <CardContent job={job} />
      {columnKey === "prep" && (
        <Link
          href={`/coach?jobId=${encodeURIComponent(job.id)}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
        >
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
          이력서 코치 피드백 받기
        </Link>
      )}
    </div>
  );
}
