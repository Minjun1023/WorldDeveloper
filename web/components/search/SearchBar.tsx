"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import type { RegionCount } from "@/lib/api";
import { pushRecentSearch } from "@/lib/recent";
import { useUpdateQuery } from "@/lib/use-update-query";

// elevated 검색 바: 키워드 + 지역 + 검색. 비자/직무 필터는 SearchFilters 로 분리.
export function SearchBar({ regions }: { regions: RegionCount[] }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const regionOptions: DropdownOption[] = regions.map((r) => ({
    value: r.value,
    label: r.label,
    count: r.count,
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) pushRecentSearch(q);
        update({ q: q || null });
      }}
      className="flex flex-col items-stretch gap-2 rounded-2xl border border-border bg-surface p-2 shadow-lg sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-2">
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="검색어, 기술 스택, 회사명..."
          aria-label="공고 검색"
          className="h-11 w-full bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 sm:w-44">
          <Dropdown
            placeholder="전체 지역"
            options={regionOptions}
            value={searchParams.get("region")}
            onSelect={(v) => update({ region: v })}
          />
        </div>
        <Button type="submit" size="lg" className="shrink-0 rounded-xl">
          검색
        </Button>
      </div>
    </form>
  );
}
