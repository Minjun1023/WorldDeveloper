"use client";

import { Menu, PanelLeft, Plus, Trash2 } from "lucide-react";

export type ConversationSummary = {
  job_id: string;
  company: string;
  title: string;
  last_active_at: string;
  preview: string;
};

// 상대시간 캡션. 잘못된 값은 빈 문자열.
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

// 항목을 오늘/어제/이전 세 그룹으로 분기(목록은 호출측 정렬 순서 유지).
function groupByDate(items: ConversationSummary[]) {
  const day = 86_400_000;
  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "오늘", items: [] },
    { label: "어제", items: [] },
    { label: "이전", items: [] },
  ];
  for (const c of items) {
    const diff = Date.now() - new Date(c.last_active_at).getTime();
    if (diff < day) groups[0].items.push(c);
    else if (diff < 2 * day) groups[1].items.push(c);
    else groups[2].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function CoachConversationRail({
  items,
  activeJobId,
  onSelect,
  onNew,
  onDelete,
  onCollapse,
}: {
  items: ConversationSummary[];
  activeJobId: string | null;
  onSelect: (jobId: string) => void;
  onNew: () => void;
  onDelete: (jobId: string) => void;
  onCollapse: () => void;
}) {
  const groups = groupByDate(items);
  return (
    <aside className="flex shrink-0 flex-col gap-2 border-b border-border p-2 lg:h-full lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCollapse}
          aria-label="대화기록 접기"
          className="hidden shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
        >
          <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNew}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-body-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> 새 상담
        </button>
      </div>

      <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-x-visible lg:overflow-y-auto">
        {items.length === 0 && (
          <li className="px-1 text-caption text-muted-foreground">아직 저장된 상담이 없어요.</li>
        )}
        {groups.map((g) => (
          <li key={g.label} className="contents">
            <p className="hidden px-1 pt-2 text-caption font-semibold text-muted-foreground lg:block">{g.label}</p>
            {g.items.map((c) => {
              const time = relativeTime(c.last_active_at);
              // 그룹 레이블과 동일한 상대시간 캡션은 중복 표시를 생략한다.
              const showTime = time && time !== g.label;
              return (
              <div key={c.job_id} className="group relative shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => onSelect(c.job_id)}
                  aria-current={activeJobId === c.job_id ? "page" : undefined}
                  className={
                    "w-44 rounded-lg px-2.5 py-2 text-left transition-colors lg:w-full " +
                    (activeJobId === c.job_id ? "bg-primary/10" : "hover:bg-accent")
                  }
                >
                  <span className="block truncate text-body-sm font-semibold text-foreground">{c.title}</span>
                  <span className="flex items-center gap-1.5 truncate text-caption text-muted-foreground">
                    <span className="truncate">{c.company}</span>
                    {showTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0">{time}</span>
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
              </div>
              );
            })}
          </li>
        ))}
      </ul>
    </aside>
  );
}

// 레일 접힘 시 메인 상단에 띄우는 ☰ 펼치기 바.
export function CoachRailReopen({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="hidden shrink-0 border-b border-border p-2 lg:block">
      <button
        type="button"
        onClick={onExpand}
        aria-label="대화기록 열기"
        className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}
