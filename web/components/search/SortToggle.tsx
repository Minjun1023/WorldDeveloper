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
    // shadcn Tabs 트리거 룩 — muted 트랙 + 활성 세그먼트는 background 로 떠오름 (북마크/커뮤니티 탭과 동일)
    <div className="inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground">
      {options.map((o) => {
        const active = effective === o.key;
        const button = (
          <button
            type="button"
            onClick={() => update({ sort: o.value })}
            aria-pressed={active}
            title={o.key === "relevance" ? RELEVANCE_HINT : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active ? "bg-background text-foreground shadow" : "hover:text-foreground",
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
              className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-64 rounded-md border border-border bg-popover px-3 py-2 text-left text-caption font-normal leading-relaxed text-muted-foreground shadow-lg group-hover:block group-focus-within:block"
            >
              {RELEVANCE_HINT}
            </span>
          </span>
        );
      })}
    </div>
  );
}
