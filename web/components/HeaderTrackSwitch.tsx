"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

// 듀얼트랙 전역 진입점. 둘다 = 전체 공고 검색(/search), 이주 = 비자 스폰서, 원격 = 한국 가능 원격.
// 활성 표시는 /search 에 있을 때 track 파라미터로만 판단(다른 페이지에선 중립).
const TRACKS: { label: string; href: string; value: string | null }[] = [
  { label: "이주", href: "/search?track=relocation", value: "relocation" },
  { label: "원격", href: "/search?track=remote", value: "remote" },
  { label: "둘다", href: "/search", value: null },
];

const NONE = "__none__"; // 활성 트랙 없음(검색 페이지가 아닐 때)

type Props = {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
};

function TrackLinks({
  activeValue,
  orientation = "horizontal",
  onNavigate,
}: Props & { activeValue: string | null }) {
  return (
    <div
      role="group"
      aria-label="트랙 선택"
      className={cn(
        "text-body-sm",
        orientation === "horizontal"
          ? "flex items-center rounded-full border border-border p-0.5"
          : "flex flex-col gap-1",
      )}
    >
      {TRACKS.map((t) => {
        const active = activeValue !== NONE && t.value === activeValue;
        return (
          <Link
            key={t.label}
            href={t.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "transition-colors",
              orientation === "horizontal" ? "rounded-full px-2.5 py-0.5" : "rounded-md px-3 py-2",
              active
                ? "bg-primary text-primary-foreground"
                : orientation === "vertical"
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function HeaderTrackSwitch({ orientation, onNavigate }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeValue = pathname === "/search" ? params.get("track") : NONE;
  return <TrackLinks activeValue={activeValue} orientation={orientation} onNavigate={onNavigate} />;
}

// useSearchParams Suspense 바운더리용 fallback (활성 표시 없는 정적 버전).
export function HeaderTrackSwitchFallback({ orientation }: Props) {
  return <TrackLinks activeValue={NONE} orientation={orientation} />;
}
