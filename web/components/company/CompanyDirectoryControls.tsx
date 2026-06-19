"use client";

import { ArrowUpDown, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useUpdateQuery } from "@/lib/use-update-query";

export type TagOption = { value: string; label: string; count?: number };

// 기업 디렉터리 상단 컨트롤 — 회사명 검색 + 분야(카테고리) + 정렬.
// URL 파라미터(q·tag·sort)가 single source of truth. useUpdateQuery 가 값 변경 시 page 를 1 로 리셋.
export function CompanyDirectoryControls({ tagOptions }: { tagOptions: TagOption[] }) {
  const sp = useSearchParams();
  const update = useUpdateQuery();

  const tag = sp.get("tag") ?? "";
  const sort = sp.get("sort") ?? "jobs";
  const [q, setQ] = useState(sp.get("q") ?? "");

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

  const selectCls =
    "h-11 cursor-pointer appearance-none rounded-xl border border-border bg-surface pl-9 pr-8 text-body-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

      {/* 분야(카테고리) */}
      <div className="relative">
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <select
          aria-label="분야 필터"
          value={tag}
          onChange={(e) => update({ tag: e.target.value || null })}
          className={selectCls}
        >
          <option value="">분야 전체</option>
          {tagOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.count !== undefined ? `${o.label} (${o.count})` : o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* 정렬 */}
      <div className="relative">
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <select
          aria-label="정렬"
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "jobs" ? null : e.target.value })}
          className={selectCls}
        >
          <option value="jobs">공고 많은 순</option>
          <option value="name">이름순</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}
