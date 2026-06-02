"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { NlRecommend, type RecommendPreset } from "@/components/home/NlRecommend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Tab = "search" | "ai";

const TABS: [Tab, string][] = [
  ["search", "공고 검색"],
  ["ai", "AI 추천"],
];

// 히어로 진입 인터랙션: 공고 검색이 기본(주), AI 추천은 보조 탭.
// 검색은 0비용·즉시(/search 라우팅), AI는 opt-in(LLM 호출).
export function HeroSearch({ presets }: { presets?: RecommendPreset[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <div className="mb-3 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1 text-body-sm">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "rounded-full px-4 py-1.5 transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "search" ? (
        <form onSubmit={submitSearch} className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="python backend, 베를린, 시니어 …"
            aria-label="공고 검색"
            className="flex-1"
          />
          <Button type="submit">검색</Button>
        </form>
      ) : (
        <div className="text-left">
          <NlRecommend presets={presets} />
        </div>
      )}
    </div>
  );
}
