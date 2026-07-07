import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// 히어로 우측 비주얼: 정부 명부로 검증된 회사 로고 월(3×3).
// 각 타일은 개별 클릭 가능 → 기업 디렉터리. 실데이터(검증 회사 로고)로 신뢰를 시각화.
export function HeroVisual({
  companies,
  totalVerified,
}: {
  companies: CompanySummary[];
  totalVerified: number;
}) {
  if (companies.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-caption font-semibold uppercase tracking-widest text-muted-foreground">
        검증된 스폰서 기업
      </p>

      <div className="grid grid-cols-3 gap-2">
        {companies.map((c) => (
          <Link
            key={c.slug}
            href={`/companies/${c.slug}`}
            className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CompanyLogo slug={c.slug} name={c.display_name} size={32} />
            <span className="truncate text-caption font-semibold text-foreground transition-colors group-hover:text-primary">
              {c.display_name}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-caption text-muted-foreground">
          USCIS·UK 내무부·NL IND 교차검증 · 총 {totalVerified}곳
        </span>
        <Link
          href="/companies"
          className="shrink-0 text-caption font-medium text-primary transition-colors hover:underline"
        >
          회사 모두 보기 →
        </Link>
      </div>
    </div>
  );
}
