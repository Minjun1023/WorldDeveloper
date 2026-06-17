"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RegionPicker, type RegionPick } from "@/components/home/RegionPicker";
import type { RegionCount } from "@/lib/api";

// 히어로 단일 검색 바: 키워드 + 지역 → /search(FTS). 추천(맞춤 매칭)은 별도 CTA로 분리해 혼동을 줄였다.
export function HeroSearch({ regions = [] }: { regions?: RegionCount[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<RegionPick>(null);

  // 원격은 근무형태지 지역(국가)이 아니므로 제외. 공고 없는 국가(count 0)도 제외 — 실제 공고 있는 지역만.
  const countries = regions.filter((r) => r.value !== "remote" && r.count > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = q.trim();
    if (query) params.set("q", query);
    if (pick?.region) params.set("region", pick.region);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 flex max-w-2xl flex-col items-stretch gap-2 rounded-lg border border-border bg-surface p-2.5 text-left sm:flex-row sm:items-center"
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
        <div className="flex-1 sm:w-48">
          <RegionPicker countries={countries} value={pick} onChange={setPick} />
        </div>
        <Button
          type="submit"
          className="bg-brand-gradient h-11 shrink-0 gap-2 rounded-xl px-5 text-white hover:opacity-95"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          검색
        </Button>
      </div>
    </form>
  );
}
