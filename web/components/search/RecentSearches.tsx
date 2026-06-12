"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { clearRecentSearches, getRecentSearches } from "@/lib/recent";
import { useUpdateQuery } from "@/lib/use-update-query";

// 최근 검색어 칩 — 클릭 시 해당 검색 재실행. 비어있으면 렌더 안 함(첫 사용자엔 미노출).
export function RecentSearches() {
  const update = useUpdateQuery();
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => setTerms(getRecentSearches()), []);

  if (terms.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption font-semibold text-muted-foreground">최근 검색어</span>
      {terms.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => update({ q: t })}
          className="rounded-full border border-border px-3 py-1 text-body-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        onClick={() => { clearRecentSearches(); setTerms([]); }}
        aria-label="최근 검색어 지우기"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
