"use client";

import { Plus, Trash2 } from "lucide-react";

export type ConversationSummary = {
  job_id: string;
  company: string;
  title: string;
  last_active_at: string;
  preview: string;
};

// 레일 항목의 상대시간 캡션(오늘/어제/N일 전, 그 이상은 날짜). 잘못된 값은 빈 문자열.
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs < day) return "오늘";
  if (diffMs < 2 * day) return "어제";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}일 전`;
  return d.toLocaleDateString("ko-KR");
}

export function CoachConversationRail({
  items,
  activeJobId,
  onSelect,
  onNew,
  onDelete,
}: {
  items: ConversationSummary[];
  activeJobId: string | null;
  onSelect: (jobId: string) => void;
  onNew: () => void;
  onDelete: (jobId: string) => void;
}) {
  return (
    <aside className="flex w-full flex-col gap-2 lg:w-60">
      <button
        type="button"
        onClick={onNew}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-body-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> 새 상담
      </button>
      <p className="px-1 pt-2 text-caption font-medium text-muted-foreground">이전 상담</p>
      <ul className="max-h-56 space-y-1 overflow-y-auto lg:max-h-none lg:overflow-visible">
        {items.length === 0 && <li className="px-1 text-caption text-muted-foreground">아직 저장된 상담이 없어요.</li>}
        {items.map((c) => (
          <li key={c.job_id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(c.job_id)}
              aria-current={activeJobId === c.job_id ? "page" : undefined}
              className={
                "w-full rounded-lg px-2.5 py-2 text-left transition-colors " +
                (activeJobId === c.job_id ? "bg-primary/10" : "hover:bg-accent")
              }
            >
              <span className="block truncate text-body-sm font-semibold text-foreground">{c.title}</span>
              <span className="flex items-center gap-1.5 truncate text-caption text-muted-foreground">
                <span className="truncate">{c.company}</span>
                {relativeTime(c.last_active_at) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{relativeTime(c.last_active_at)}</span>
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              aria-label="상담 삭제"
              onClick={() => onDelete(c.job_id)}
              className="absolute right-1 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
