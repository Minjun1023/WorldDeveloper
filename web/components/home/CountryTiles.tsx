import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { RegionCount } from "@/lib/api";
import { regionFlag } from "@/lib/flags";

// /regions 기반 자동화: 공고수 내림차순으로 정렬해 타일 렌더. 원격 제외는 호출부(page.tsx)에서 처리.
// limit 을 주면 상위 N개만 렌더(홈은 10개=5×2, 전체는 /regions 페이지).
export function CountryTiles({ regions, limit }: { regions: RegionCount[]; limit?: number }) {
  const sorted = [...regions].sort((a, b) => b.count - a.count);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {shown.map((c) => {
        const flag = regionFlag(c.value);
        return (
          <Link
            key={c.value}
            href={`/search?region=${c.value}`}
            className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {flag && (
                <span className="text-2xl leading-none" aria-hidden="true">
                  {flag}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold leading-tight">{c.label}</div>
                <div className="mt-0.5 text-caption text-muted-foreground">공고 {c.count}</div>
              </div>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}
