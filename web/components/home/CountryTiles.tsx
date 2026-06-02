import Link from "next/link";

import type { RegionCount } from "@/lib/api";
import { regionFlag } from "@/lib/flags";

// /regions 기반 자동화: 공고수 내림차순으로 정렬해 타일 렌더. 원격 제외는 호출부(page.tsx)에서 처리.
export function CountryTiles({ regions }: { regions: RegionCount[] }) {
  const sorted = [...regions].sort((a, b) => b.count - a.count);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {sorted.map((c) => {
        const flag = regionFlag(c.value);
        return (
          <Link
            key={c.value}
            href={`/search?region=${c.value}`}
            className="rounded-lg border border-border bg-surface-2 p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-2">
              {flag && (
                <span className="text-xl leading-none" aria-hidden="true">
                  {flag}
                </span>
              )}
              <span className="font-semibold">{c.label}</span>
            </div>
            <div className="mt-1 text-caption text-muted-foreground">{c.count}개 공고</div>
          </Link>
        );
      })}
    </div>
  );
}
