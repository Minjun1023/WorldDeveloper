"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

// 정렬 세그먼트 컨트롤. value=null 은 "관련도순"(검색어 없으면 백엔드 기본 = 최신순).
const OPTIONS: { value: string | null; key: string; label: string }[] = [
  { value: null, key: "relevance", label: "관련도순" },
  { value: "recent", key: "recent", label: "최신순" },
  { value: "newest", key: "newest", label: "게시일순" },
  { value: "salary", key: "salary", label: "연봉순" },
];

const RELEVANCE_HINT = "검색어와 관련도가 높은 공고부터 보여줘요.";

export function SortToggle() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const q = searchParams.get("q");
  const sort = searchParams.get("sort");
  const hasQuery = !!q?.trim();
  // page.tsx 와 동일한 기본값 규칙
  const effective = sort ?? (hasQuery ? "relevance" : "recent");
  // 검색어가 없으면 관련도순은 최신순과 동일하게 동작하므로 숨긴다(중복 제거).
  const options = hasQuery ? OPTIONS : OPTIONS.filter((o) => o.key !== "relevance");

  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-body-sm">
      {options.map((o) => {
        const active = effective === o.key;
        const button = (
          <button
            type="button"
            onClick={() => update({ sort: o.value })}
            aria-pressed={active}
            title={o.key === "relevance" ? RELEVANCE_HINT : undefined}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );

        if (o.key !== "relevance") {
          return <span key={o.key} className="inline-flex">{button}</span>;
        }

        // 관련도순: 검색어가 있어야 동작한다는 설명 툴팁(호버/포커스)
        return (
          <span key={o.key} className="group relative inline-flex">
            {button}
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-64 rounded-md border border-border bg-surface px-3 py-2 text-left text-caption font-normal leading-relaxed text-muted-foreground shadow-lg group-hover:block group-focus-within:block"
            >
              {RELEVANCE_HINT}
            </span>
          </span>
        );
      })}
    </div>
  );
}
