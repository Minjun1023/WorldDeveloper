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

// 로그인 안 한 상태: 해당 탭의 실제 화면을 블러 처리해 뒤에 깔고, 그 위에 로그인 안내를 띄움.
// backdrop 은 인증 호출/상호작용 없는 정적 스켈레톤(블러라 디테일은 불필요, 레이아웃만 재현).
function LockedPreview({ backdrop }: { backdrop: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
        {backdrop}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-surface/50 pt-16 backdrop-blur-[1px]">
        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-md">
          <p className="text-body-sm text-muted-foreground">로그인하면 이용할 수 있어요.</p>
          <Link
            href="/signin?callbackUrl=/bookmarks"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}

// 공고 관리 칸반의 빈 화면 모양(JobTrackerBoard 레이아웃과 동일한 컬럼 구성).
const BOARD_COLUMNS = ["지원 준비중", "지원완료", "면접", "불합격", "합격"];

function TrackerSkeleton() {
  return (
    <div className="flex h-[calc(100vh-17rem)] gap-2 overflow-hidden sm:gap-3">
      <div className="flex w-52 shrink-0 flex-col">
        <div className="mb-2 px-1 text-body-sm font-semibold">
          북마크 공고 <span className="text-primary">0개</span>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-2.5 text-caption font-medium text-muted-foreground">
          + 공고 추가
        </div>
      </div>
      {BOARD_COLUMNS.map((label) => (
        <div
          key={label}
          className="flex min-w-[14rem] flex-1 flex-col rounded-xl border border-border bg-surface-2 p-2 md:min-w-0"
        >
          <div className="mb-2 flex items-center gap-1.5 px-1 text-body-sm font-semibold">
            {label}
            <span className="rounded-full bg-foreground/10 px-1.5 text-caption tabular-nums">0</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 북마크 전체 / 관심 기업 탭의 카드 그리드 모양.
function CardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-lg border border-border bg-surface" />
      ))}
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

      {tab === "tracker" &&
        (loggedIn ? <JobTrackerBoard /> : <LockedPreview backdrop={<TrackerSkeleton />} />)}
      {tab === "all" &&
        (loggedIn ? <SavedJobsList /> : <LockedPreview backdrop={<CardsSkeleton />} />)}
      {tab === "companies" &&
        (loggedIn ? <FavoriteCompaniesList /> : <LockedPreview backdrop={<CardsSkeleton />} />)}
      {tab === "recent" && <RecentJobsTab />}
    </div>
  );
}
