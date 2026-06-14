"use client";

import { Search, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import type { RegionCount } from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "keyword" | "match";

// 히어로 검색 바: 두 모드. '키워드 검색'=FTS(/search), '맞춤 매칭'=추천 엔진(/recommend, 조건은 note).
// 둘은 성격이 다른 진짜 모드 — 키워드는 텍스트 매칭, 맞춤 매칭은 6축 프로필 채점(로그인 시 내 프로필 자동).
export function HeroSearch({ regions = [] }: { regions?: RegionCount[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("keyword");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);

  const regionOptions = regions.map((r) => ({ value: r.value, label: r.label, count: r.count }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (mode === "match") {
      // 조건을 note 로 추천 엔진에 전달. 비로그인은 /recommend 가 로그인 안내로 게이팅.
      router.push(text ? `/recommend?note=${encodeURIComponent(text)}` : "/recommend");
      return;
    }
    const params = new URLSearchParams();
    if (text) params.set("q", text);
    if (region) params.set("region", region);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  const tabs: { value: Mode; label: string; icon: typeof Search }[] = [
    { value: "keyword", label: "키워드 검색", icon: Search },
    { value: "match", label: "맞춤 매칭", icon: Target },
  ];

  return (
    <div className="mt-8 max-w-2xl">
      {/* 모드 토글 */}
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = mode === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="mt-2 flex flex-col items-stretch gap-2 rounded-2xl border border-border bg-surface p-2.5 text-left shadow-lg sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 px-1.5">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              mode === "keyword"
                ? "어떤 일을 찾고 계세요? (예: React, 백엔드, ML)"
                : "조건을 적어보세요 (예: 비자 되는 독일 백엔드 시니어, 원격 가능)"
            }
            aria-label={mode === "keyword" ? "공고 검색" : "맞춤 매칭 조건"}
            className="h-11 w-full bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {mode === "keyword" && (
            <div className="flex-1 sm:w-44">
              <Dropdown
                placeholder="전체 지역"
                options={regionOptions}
                value={region}
                onSelect={setRegion}
              />
            </div>
          )}
          <Button
            type="submit"
            className="bg-brand-gradient h-11 shrink-0 gap-2 rounded-xl px-5 text-white hover:opacity-95"
          >
            {mode === "keyword" ? (
              <>
                <Search className="h-4 w-4" aria-hidden="true" /> 공고 검색
              </>
            ) : (
              <>
                <Target className="h-4 w-4" aria-hidden="true" /> 맞춤 매칭
              </>
            )}
          </Button>
        </div>
      </form>

      {mode === "match" && (
        <p className="mt-2 px-1 text-caption text-muted-foreground">
          조건을 적으면 6가지 기준으로 맞는 공고를 찾아드려요. 로그인하면 내 프로필로 자동 매칭돼요.
        </p>
      )}
    </div>
  );
}
