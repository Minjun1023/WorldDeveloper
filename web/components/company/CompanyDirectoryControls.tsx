"use client";

import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AnchoredPopover } from "@/components/ui/AnchoredPopover";
import { canonicalTag } from "@/lib/company-tags";
import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

export type TagOption = { value: string; label: string; desc?: string; count?: number };

const SORT_OPTIONS = [
  { value: "jobs", label: "공고 많은 순" },
  { value: "name", label: "이름순" },
];

// 기업 디렉터리 상단 컨트롤 — 회사명 검색 + 분야(카테고리) + 정렬.
// 분야·정렬은 OS 기본 <select> 대신 디자인 시스템 모달(Dialog)로 선택 — 일관된 스타일 + 카운트 표기.
// URL 파라미터(q·tag·sort)가 single source of truth. useUpdateQuery 가 값 변경 시 page 를 1 로 리셋.
export function CompanyDirectoryControls({
  tagOptions,
  sizeOptions = [],
}: {
  tagOptions: TagOption[];
  sizeOptions?: TagOption[];
}) {
  const sp = useSearchParams();
  const update = useUpdateQuery();

  // 별칭 표기(?tag=health-tech 딥링크)도 대표 키 옵션에 매칭되도록 정규화.
  const tag = canonicalTag(sp.get("tag") ?? "");
  const size = sp.get("size") ?? "";
  const sort = sp.get("sort") ?? "jobs";
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [tagOpen, setTagOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
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
  const sizeLabel = size ? sizeOptions.find((o) => o.value === size)?.label ?? size : "규모 전체";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "공고 많은 순";

  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const menuCls = "rounded-xl border border-border bg-surface p-1 shadow-lg";
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

      {/* 분야(카테고리) — 트리거 위치에 포털로 렌더되는 드롭다운(조상 overflow/stacking 무관) */}
      <button
        ref={tagBtnRef}
        type="button"
        onClick={() => {
          setSortOpen(false);
          setSizeOpen(false);
          setTagOpen((o) => !o);
        }}
        aria-expanded={tagOpen}
        aria-label="분야 필터"
        className={triggerCls}
      >
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{tagLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", tagOpen && "rotate-180")} aria-hidden="true" />
      </button>
      <AnchoredPopover open={tagOpen} onClose={() => setTagOpen(false)} anchorRef={tagBtnRef} width={288}>
        <ul className={cn("max-h-80 overflow-y-auto", menuCls)}>
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
              label={o.label}
              desc={o.desc}
              count={o.count}
              onClick={() => {
                update({ tag: o.value });
                setTagOpen(false);
              }}
            />
          ))}
        </ul>
      </AnchoredPopover>

      {/* 기업 규모(직원 수 밴드) */}
      {sizeOptions.length > 0 && (
        <>
          <button
            ref={sizeBtnRef}
            type="button"
            onClick={() => {
              setTagOpen(false);
              setSortOpen(false);
              setSizeOpen((o) => !o);
            }}
            aria-expanded={sizeOpen}
            aria-label="기업 규모 필터"
            className={triggerCls}
          >
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{sizeLabel}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sizeOpen && "rotate-180")} aria-hidden="true" />
          </button>
          <AnchoredPopover open={sizeOpen} onClose={() => setSizeOpen(false)} anchorRef={sizeBtnRef} width={208}>
            <ul className={menuCls}>
              <OptionRow
                selected={size === ""}
                label="규모 전체"
                onClick={() => {
                  update({ size: null });
                  setSizeOpen(false);
                }}
              />
              {sizeOptions.map((o) => (
                <OptionRow
                  key={o.value}
                  selected={size === o.value}
                  label={o.label}
                  count={o.count}
                  onClick={() => {
                    update({ size: o.value });
                    setSizeOpen(false);
                  }}
                />
              ))}
            </ul>
          </AnchoredPopover>
        </>
      )}

      {/* 정렬 — 트리거 위치에 포털로 렌더되는 드롭다운 */}
      <button
        ref={sortBtnRef}
        type="button"
        onClick={() => {
          setTagOpen(false);
          setSizeOpen(false);
          setSortOpen((o) => !o);
        }}
        aria-expanded={sortOpen}
        aria-label="정렬"
        className={triggerCls}
      >
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{sortLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sortOpen && "rotate-180")} aria-hidden="true" />
      </button>
      <AnchoredPopover open={sortOpen} onClose={() => setSortOpen(false)} anchorRef={sortBtnRef} width={192}>
        <ul className={menuCls}>
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
      </AnchoredPopover>
    </div>
  );
}

function OptionRow({
  selected,
  label,
  desc,
  count,
  onClick,
}: {
  selected: boolean;
  label: string;
  // 한국어 보조 설명(영문 라벨 옆 muted 텍스트) — 업계 용어가 낯선 사용자를 위한 병기.
  desc?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-body-sm hover:bg-surface-2",
          selected ? "font-semibold text-primary" : "text-foreground",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0">{label}</span>
          {desc && <span className="truncate font-normal text-caption text-muted-foreground">{desc}</span>}
          {selected && <Check className="h-3.5 w-3.5 shrink-0 self-center text-primary" aria-hidden="true" />}
        </span>
        {count !== undefined && (
          <span className={cn("shrink-0 tabular-nums", selected ? "text-primary/60" : "text-muted-foreground")}>
            {count.toLocaleString()}
          </span>
        )}
      </button>
    </li>
  );
}
