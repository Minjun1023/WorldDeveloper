"use client";

import { useState } from "react";

import { JobTrackerBoard } from "@/components/bookmarks/JobTrackerBoard";
import { RecentJobsTab } from "@/components/bookmarks/RecentJobsTab";
import { FavoriteCompaniesList } from "@/components/company/FavoriteCompaniesList";
import { SavedJobsList } from "@/components/saved/SavedJobsList";
import { cn } from "@/lib/utils";

// 북마크 탭 — 직행 북마크 영역 구조: 공고 관리(칸반) / 북마크 전체 / 관심 기업 / 최근 본 공고.
const TABS = [
  { key: "tracker", label: "공고 관리" },
  { key: "all", label: "북마크 전체" },
  { key: "companies", label: "관심 기업" },
  { key: "recent", label: "최근 본 공고" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function BookmarksTabs() {
  const [tab, setTab] = useState<TabKey>("tracker");

  return (
    <div className="space-y-6">
      <div className="flex gap-5 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative -mb-px shrink-0 border-b-2 px-1 py-3 text-body-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tracker" && <JobTrackerBoard />}
      {tab === "all" && <SavedJobsList />}
      {tab === "companies" && <FavoriteCompaniesList />}
      {tab === "recent" && <RecentJobsTab />}
    </div>
  );
}
