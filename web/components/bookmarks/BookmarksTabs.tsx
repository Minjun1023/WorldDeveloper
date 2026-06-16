"use client";

import Link from "next/link";
import { useState } from "react";

import { JobTrackerBoard } from "@/components/bookmarks/JobTrackerBoard";
import { RecentJobsTab } from "@/components/bookmarks/RecentJobsTab";
import { FavoriteCompaniesList } from "@/components/company/FavoriteCompaniesList";
import { SavedJobsList } from "@/components/saved/SavedJobsList";
import { cn } from "@/lib/utils";

// 북마크 탭 — 직행 북마크 영역 구조: 공고 관리(칸반) / 북마크 전체 / 관심 기업 / 최근 본 공고.
// 탭이 최상단. 공고 관리·북마크 전체·관심 기업은 로그인 필요, 최근 본 공고는 공개.
const TABS = [
  { key: "tracker", label: "공고 관리" },
  { key: "all", label: "북마크 전체" },
  { key: "companies", label: "관심 기업" },
  { key: "recent", label: "최근 본 공고" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function LoginGate() {
  return (
    <div className="rounded-lg border border-border bg-surface p-10 text-center">
      <p className="text-body-sm text-muted-foreground">로그인하면 이용할 수 있어요.</p>
      <Link
        href="/signin?callbackUrl=/bookmarks"
        className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground"
      >
        로그인
      </Link>
    </div>
  );
}

export function BookmarksTabs({ loggedIn }: { loggedIn: boolean }) {
  const [tab, setTab] = useState<TabKey>("tracker");

  return (
    <div className="space-y-4">
      <div className="flex gap-5 overflow-x-auto overflow-y-hidden border-b border-border" role="tablist">
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

      {tab === "tracker" && (loggedIn ? <JobTrackerBoard /> : <LoginGate />)}
      {tab === "all" && (loggedIn ? <SavedJobsList /> : <LoginGate />)}
      {tab === "companies" && (loggedIn ? <FavoriteCompaniesList /> : <LoginGate />)}
      {tab === "recent" && <RecentJobsTab />}
    </div>
  );
}
