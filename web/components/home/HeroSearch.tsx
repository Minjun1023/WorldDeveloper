"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import type { RegionCount } from "@/lib/api";

// 히어로 단일 검색 바: 키워드 + 지역 + 공고 검색. 선택 시 /search 로 라우팅(0비용·즉시).
export function HeroSearch({ regions = [] }: { regions?: RegionCount[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);

  const regionOptions = regions.map((r) => ({ value: r.value, label: r.label, count: r.count }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = q.trim();
    if (query) params.set("q", query);
    if (region) params.set("region", region);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 flex max-w-2xl flex-col items-stretch gap-2 rounded-2xl border border-border bg-surface p-2.5 text-left shadow-lg sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-2 px-1.5">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="어떤 일을 찾고 계세요? (예: React, 백엔드, ML)"
          aria-label="공고 검색"
          className="h-11 w-full bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 sm:w-44">
          <Dropdown
            placeholder="전체 지역"
            options={regionOptions}
            value={region}
            onSelect={setRegion}
          />
        </div>
        <Button
          type="submit"
          className="bg-brand-gradient h-11 shrink-0 gap-2 rounded-xl px-5 text-white hover:opacity-95"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          공고 검색
        </Button>
      </div>
    </form>
  );
}
