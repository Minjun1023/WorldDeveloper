"use client";

import { Plus, Trash2 } from "lucide-react";

export type ConversationSummary = {
  jobId: string;
  company: string;
  title: string;
  lastActiveAt: string;
  preview: string;
};

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
      <ul className="space-y-1">
        {items.length === 0 && <li className="px-1 text-caption text-muted-foreground">아직 저장된 상담이 없어요.</li>}
        {items.map((c) => (
          <li key={c.jobId} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(c.jobId)}
              aria-current={activeJobId === c.jobId}
              className={
                "w-full rounded-lg px-2.5 py-2 text-left transition-colors " +
                (activeJobId === c.jobId ? "bg-primary/10" : "hover:bg-accent")
              }
            >
              <span className="block truncate text-body-sm font-semibold text-foreground">{c.title}</span>
              <span className="block truncate text-caption text-muted-foreground">{c.company}</span>
            </button>
            <button
              type="button"
              aria-label="상담 삭제"
              onClick={() => onDelete(c.jobId)}
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
