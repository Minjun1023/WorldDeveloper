"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { pushRecentSearch } from "@/lib/recent";
import { useUpdateQuery } from "@/lib/use-update-query";

// 검색 바: 키워드만. 지역·비자·직무 등 필터는 좌측 FilterSidebar 로 분리.
export function SearchBar() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) pushRecentSearch(q);
        update({ q: q || null });
      }}
      className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-lg"
    >
      <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {/* min-w-0: flex 아이템의 min-width:auto 기본값 때문에 긴 placeholder 가
          input 을 못 줄이게 해 모바일에서 검색 버튼과 겹치던 문제 방지. */}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="직무, 기술 스택, 회사명 검색"
        aria-label="공고 검색"
        className="h-11 w-full min-w-0 flex-1 bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
      />
      <Button type="submit" size="lg" className="shrink-0 rounded-xl">
        검색
      </Button>
    </form>
  );
}
