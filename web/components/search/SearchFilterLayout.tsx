"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { FilterSidebar } from "@/components/search/FilterSidebar";
import { Button } from "@/components/ui/button";
import type { RegionCount } from "@/lib/api";

// 검색 필터 + 결과 레이아웃.
// - 데스크톱(lg+): 좌측 사이드바. 가로로 접으면 결과가 전체 폭, 접힌 자리에 "필터" 버튼(직행 스타일).
// - 모바일(<lg): 사이드바 대신 "필터 (n)" 버튼 → 바텀시트. 국가 50여 개가 결과를 밀어내지 않도록.
export function SearchFilterLayout({
  regions,
  children,
}: {
  regions: RegionCount[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sp = useSearchParams();

  // 활성 필터 수 — 모바일 버튼에 (n)으로 표시해 시트 안 열어도 상태를 알 수 있게.
  const activeCount =
    (sp.get("region") ?? "").split(",").filter(Boolean).length +
    (sp.get("discipline") ? 1 : 0) +
    (sp.get("remote") === "true" ? 1 : 0);

  // 시트 열림 동안 배경 스크롤 잠금 + ESC 닫기.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const filterButton = (extra: string, onClick: () => void) => (
    <Button type="button" variant="outline" onClick={onClick} className={extra}>
      <SlidersHorizontal aria-hidden="true" />
      필터
      {activeCount > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-caption font-semibold text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );

  return (
    <>
      <div className={collapsed ? "space-y-4" : "grid gap-6 lg:grid-cols-[260px_1fr]"}>
        {!collapsed && (
          <div className="hidden lg:block">
            <FilterSidebar regions={regions} onCollapse={() => setCollapsed(true)} />
          </div>
        )}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 lg:hidden">
            {filterButton("", () => setSheetOpen(true))}
          </div>
          {collapsed && (
            <div className="hidden lg:block">{filterButton("", () => setCollapsed(false))}</div>
          )}
          {children}
        </div>
      </div>

      {/* 모바일 바텀시트 — 스크림 탭/ESC/결과 보기 버튼으로 닫기 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="검색 필터"
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-body font-bold text-foreground">필터</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSheetOpen(false)}
                aria-label="필터 닫기"
                className="[&_svg]:size-5"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FilterSidebar regions={regions} plain />
            </div>
            <div className="border-t border-border p-4">
              <Button type="button" size="lg" onClick={() => setSheetOpen(false)} className="w-full">
                결과 보기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
