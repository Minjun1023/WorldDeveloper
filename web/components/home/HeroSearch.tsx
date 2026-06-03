"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { cn } from "@/lib/utils";
import { VISA_OPTIONS } from "@/lib/visa-options";

type Tab = "search" | "ai";

const TABS: [Tab, string][] = [
  ["search", "공고 검색"],
  ["ai", "AI 추천"],
];

// 히어로 진입 인터랙션: 공고 검색이 기본(주), AI 추천은 보조 탭.
// 검색 탭은 키워드 + 지역/직무/비자 옵션을 모아 /search 로 라우팅(0비용·즉시). AI는 opt-in(LLM).
export function HeroSearch({
  regions = [],
  loggedIn,
}: {
  regions?: RegionCount[];
  loggedIn?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [visa, setVisa] = useState<string | null>(null);

  const regionOptions = regions.map((r) => ({ value: r.value, label: r.label, count: r.count }));

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = q.trim();
    if (query) params.set("q", query);
    if (region) params.set("region", region);
    if (discipline) params.set("discipline", discipline);
    // 비자 드롭다운의 "원격근무"는 remote 필터로 매핑(/search 와 동일 규칙)
    if (visa === "remote") params.set("remote", "true");
    else if (visa) params.set("visa", visa);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
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
        <form onSubmit={submitSearch} className="space-y-2 text-left">
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="python backend, react senior …"
              aria-label="공고 검색"
              className="flex-1"
            />
            <Button type="submit">검색</Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Dropdown placeholder="지역" options={regionOptions} value={region} onSelect={setRegion} />
            <Dropdown placeholder="직무" options={DISCIPLINES} value={discipline} onSelect={setDiscipline} />
            <Dropdown placeholder="비자" options={VISA_OPTIONS} value={visa} onSelect={setVisa} />
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          {loggedIn ? (
            <>
              <p className="text-body-sm text-muted-foreground">프로필 기반으로 맞춤 공고를 추천해드려요.</p>
              <Link href="/recommend" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
                맞춤 추천 보기
              </Link>
            </>
          ) : (
            <>
              <p className="text-body-sm text-muted-foreground">로그인하면 프로필 기반 맞춤 공고 추천을 받을 수 있어요.</p>
              <Link href="/signin" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
                로그인 / 회원가입
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
