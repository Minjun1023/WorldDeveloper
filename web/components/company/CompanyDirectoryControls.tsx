"use client";

import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

export type TagOption = { value: string; label: string; count?: number };

const SORT_OPTIONS = [
  { value: "jobs", label: "공고 많은 순" },
  { value: "name", label: "이름순" },
];

// 기업 디렉터리 상단 컨트롤 — 회사명 검색 + 분야(카테고리) + 정렬.
// 분야·정렬은 OS 기본 <select> 대신 디자인 시스템 모달(Dialog)로 선택 — 일관된 스타일 + 카운트 표기.
// URL 파라미터(q·tag·sort)가 single source of truth. useUpdateQuery 가 값 변경 시 page 를 1 로 리셋.
export function CompanyDirectoryControls({ tagOptions }: { tagOptions: TagOption[] }) {
  const sp = useSearchParams();
  const update = useUpdateQuery();

  const tag = sp.get("tag") ?? "";
  const sort = sp.get("sort") ?? "jobs";
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [tagOpen, setTagOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // 입력 디바운스 — 멈춘 뒤 350ms 후에만 q 갱신(키 입력마다 서버 라운드트립 방지).
  const updateRef = useRef(update);
  updateRef.current = update;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => updateRef.current({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
  }, [q]);

  const tagLabel = tag ? tagOptions.find((o) => o.value === tag)?.label ?? tag : "분야 전체";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "공고 많은 순";

  const triggerCls =
    "relative flex h-11 items-center gap-2 rounded-xl border border-border bg-surface pl-9 pr-3 text-body-sm font-medium text-foreground outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* 회사명 검색 */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="회사명 검색"
          aria-label="회사명 검색"
          className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-body-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 분야(카테고리) — 클릭 시 모달 */}
      <button type="button" onClick={() => setTagOpen(true)} aria-haspopup="dialog" aria-label="분야 필터" className={triggerCls}>
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{tagLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {/* 정렬 — 클릭 시 모달 */}
      <button type="button" onClick={() => setSortOpen(true)} aria-haspopup="dialog" aria-label="정렬" className={triggerCls}>
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{sortLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <Dialog open={tagOpen} onClose={() => setTagOpen(false)} title="분야 선택">
        <ul className="space-y-0.5">
          <OptionRow
            selected={tag === ""}
            label="분야 전체"
            onClick={() => {
              update({ tag: null });
              setTagOpen(false);
            }}
          />
          {tagOptions.map((o) => (
            <OptionRow
              key={o.value}
              selected={tag === o.value}
              label={o.count !== undefined ? `${o.label} (${o.count})` : o.label}
              onClick={() => {
                update({ tag: o.value });
                setTagOpen(false);
              }}
            />
          ))}
        </ul>
      </Dialog>

      <Dialog open={sortOpen} onClose={() => setSortOpen(false)} title="정렬">
        <ul className="space-y-0.5">
          {SORT_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={sort === o.value}
              label={o.label}
              onClick={() => {
                update({ sort: o.value === "jobs" ? null : o.value });
                setSortOpen(false);
              }}
            />
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

function OptionRow({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-body-sm hover:bg-surface-2",
          selected ? "font-semibold text-primary" : "text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
      </button>
    </li>
  );
}
