"use client";

import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { canonicalTag } from "@/lib/company-tags";
import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

export type TagOption = { value: string; label: string; desc?: string; count?: number };

const SORT_OPTIONS = [
  { value: "jobs", label: "공고 많은 순" },
  { value: "name", label: "이름순" },
];

// 기업 디렉터리 상단 컨트롤 — 회사명 검색 + 분야(카테고리) + 규모 + 정렬.
// 드롭다운은 shadcn DropdownMenu(Radix) — 포지셔닝·포커스 트랩·키보드 내비 내장.
// URL 파라미터(q·tag·size·sort)가 single source of truth. useUpdateQuery 가 값 변경 시 page 를 1 로 리셋.
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

  // 입력 디바운스 — 멈춘 뒤 350ms 후에만 q 갱신(키 입력마다 서버 라운드트립 방지).
  // 입력값이 URL 의 q 와 다를 때만 push 한다. firstRender 가드 방식은 StrictMode 의
  // 이중 effect 실행을 못 막아, 상세 → 뒤로가기 복귀 시 q:null push 로 page 파라미터가
  // 삭제되는(항상 1페이지로 리셋) 버그가 있었다.
  const updateRef = useRef(update);
  updateRef.current = update;
  const spQ = sp.get("q") ?? "";
  useEffect(() => {
    if (q.trim() === spQ) return; // URL 과 이미 일치 — 마운트/뒤로가기 복원 시 오발사 방지
    const id = setTimeout(() => updateRef.current({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
  }, [q, spQ]);

  const tagLabel = tag ? tagOptions.find((o) => o.value === tag)?.label ?? tag : "분야 전체";
  const sizeLabel = size ? sizeOptions.find((o) => o.value === size)?.label ?? size : "규모 전체";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "공고 많은 순";

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* 회사명 검색 */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="회사명 검색"
          aria-label="회사명 검색"
          className="pl-9"
        />
      </div>

      {/* 분야(카테고리) */}
      <FilterDropdown
        icon={<SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        label={tagLabel}
        ariaLabel="분야 필터"
        contentClassName="w-72"
      >
        <div className="max-h-80 overflow-y-auto">
          <OptionItem selected={tag === ""} label="분야 전체" onSelect={() => update({ tag: null })} />
          {tagOptions.map((o) => (
            <OptionItem
              key={o.value}
              selected={tag === o.value}
              label={o.label}
              desc={o.desc}
              count={o.count}
              onSelect={() => update({ tag: o.value })}
            />
          ))}
        </div>
      </FilterDropdown>

      {/* 기업 규모(직원 수 밴드) */}
      {sizeOptions.length > 0 && (
        <FilterDropdown
          icon={<Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          label={sizeLabel}
          ariaLabel="기업 규모 필터"
          contentClassName="w-52"
        >
          <OptionItem selected={size === ""} label="규모 전체" onSelect={() => update({ size: null })} />
          {sizeOptions.map((o) => (
            <OptionItem
              key={o.value}
              selected={size === o.value}
              label={o.label}
              count={o.count}
              onSelect={() => update({ size: o.value })}
            />
          ))}
        </FilterDropdown>
      )}

      {/* 정렬 */}
      <FilterDropdown
        icon={<ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        label={sortLabel}
        ariaLabel="정렬"
        contentClassName="w-48"
      >
        {SORT_OPTIONS.map((o) => (
          <OptionItem
            key={o.value}
            selected={sort === o.value}
            label={o.label}
            onSelect={() => update({ sort: o.value === "jobs" ? null : o.value })}
          />
        ))}
      </FilterDropdown>
    </div>
  );
}

function FilterDropdown({
  icon,
  label,
  ariaLabel,
  contentClassName,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring [&[data-state=open]>.chevron]:rotate-180"
      >
        {icon}
        <span className="truncate">{label}</span>
        <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OptionItem({
  selected,
  label,
  desc,
  count,
  onSelect,
}: {
  selected: boolean;
  label: string;
  // 한국어 보조 설명(영문 라벨 옆 muted 텍스트) — 업계 용어가 낯선 사용자를 위한 병기.
  desc?: string;
  count?: number;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        "flex items-center justify-between gap-3",
        selected && "font-semibold text-primary",
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
    </DropdownMenuItem>
  );
}
