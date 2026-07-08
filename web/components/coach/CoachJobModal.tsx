"use client";

import { Briefcase, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PickJob = { id: string; title: string; company: { display_name: string }; location?: string };

export function CoachJobModal({
  open,
  jobs,
  jobsLoading,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  jobs: PickJob[];
  jobsLoading: boolean;
  selectedId: string;
  onSelect: (jobId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [q, setQ] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const filtered = jobs.filter(
    (j) => `${j.company.display_name} ${j.title}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-border p-5">
        <h2 id={titleId} className="text-h3 font-semibold">공고 첨부</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-3 p-5">
        {/* 코치 후보 = 저장(북마크)한 공고. 하나도 없으면 검색창 대신 저장 유도 안내를 띄운다
            — 페이지 게이트(NoJobs) 대신 여기서 안내하는 구조. */}
        {!jobsLoading && jobs.length === 0 ? (
          <div className="py-6 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-body font-semibold text-foreground">상담할 공고가 없어요</p>
            <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-muted-foreground">
              코치는 <span className="font-semibold text-foreground">저장한 공고</span> 중에서
              골라요. 맞춤 추천이나 검색에서 마음에 드는 공고를 하트(저장)로 담아 주세요.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
                맞춤 추천에서 저장하기
              </Link>
              <Link href="/search" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                공고 검색하기
              </Link>
            </div>
          </div>
        ) : (
        <>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="공고 검색"
          placeholder="공고 검색…"
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {jobsLoading && <p className="px-1 text-body-sm text-muted-foreground">공고 불러오는 중…</p>}
          {!jobsLoading && filtered.length === 0 && (
            <p className="px-1 text-body-sm text-muted-foreground">검색 결과가 없어요.</p>
          )}
          {filtered.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => {
                onSelect(j.id);
                onClose();
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                selectedId === j.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body-sm font-semibold text-foreground">{j.title}</span>
                <span className="block truncate text-caption text-muted-foreground">
                  {j.company.display_name}
                  {j.location ? ` · ${j.location}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
        </>
        )}
      </div>
    </dialog>
  );
}
