"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { JobTrackerBoard } from "@/components/bookmarks/JobTrackerBoard";
import { RecentJobsTab } from "@/components/bookmarks/RecentJobsTab";
import { FavoriteCompaniesList } from "@/components/company/FavoriteCompaniesList";
import { SavedJobsList } from "@/components/saved/SavedJobsList";
import { buttonVariants } from "@/components/ui/button";
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
function LockedPreview({ backdrop, tab }: { backdrop: React.ReactNode; tab: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
        {backdrop}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-surface/50 pt-16 backdrop-blur-[1px]">
        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-md">
          <p className="text-body-sm text-muted-foreground">로그인하면 이용할 수 있어요.</p>
          <Link
            href={`/signin?callbackUrl=${encodeURIComponent(`/bookmarks?tab=${tab}`)}`}
            className={cn(buttonVariants(), "mt-3")}
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

const TAB_KEYS = new Set<string>(TABS.map((t) => t.key));

export function BookmarksTabs({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // 탭을 URL(?tab=)과 동기화 — 딥링크(/bookmarks?tab=tracker)·로그인 복귀 시 탭 유지.
  const urlTab = sp.get("tab");
  const [tab, setTab] = useState<TabKey>(
    urlTab && TAB_KEYS.has(urlTab) ? (urlTab as TabKey) : "tracker",
  );
  const selectTab = (key: TabKey) => {
    setTab(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false }); // 히스토리 오염 없이 URL 만 갱신
  };

  return (
    <div className="space-y-4">
      {/* shadcn Tabs 트리거 룩 — muted 트랙 + 활성 탭은 background 로 떠오름 */}
      <div
        className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground"
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => selectTab(t.key)}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              tab === t.key
                ? "rounded-md bg-background font-medium text-foreground shadow"
                : "hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tracker" &&
        (loggedIn ? <JobTrackerBoard /> : <LockedPreview tab="tracker" backdrop={<TrackerSkeleton />} />)}
      {tab === "all" &&
        (loggedIn ? <SavedJobsList /> : <LockedPreview tab="all" backdrop={<CardsSkeleton />} />)}
      {tab === "companies" &&
        (loggedIn ? <FavoriteCompaniesList /> : <LockedPreview tab="companies" backdrop={<CardsSkeleton />} />)}
      {tab === "recent" && <RecentJobsTab />}
    </div>
  );
}
