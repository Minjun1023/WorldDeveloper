import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// SponsorMap 의 "실제 등재 스폰서 로고 칩" 패턴. 신뢰 마이크로카피 + 검증된 회사 로고 칩.
// companies 가 비면 렌더링하지 않음.
export function SponsorChips({ companies }: { companies: CompanySummary[] }) {
  if (companies.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col items-center gap-2 text-caption text-muted-foreground sm:flex-row sm:justify-center">
      <span>무료 · 회원가입 불필요</span>
      <span className="hidden sm:inline" aria-hidden="true">
        ·
      </span>
      <span className="flex items-center gap-2">
        <span className="text-verified">이미 등재된 스폰서</span>
        <span className="flex flex-wrap items-center gap-2">
          {companies.map((c) => (
            <Link
              key={c.slug}
              href={`/companies/${c.slug}`}
              title={c.display_name}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 transition-colors hover:border-primary/40"
            >
              <CompanyLogo slug={c.slug} name={c.display_name} size={20} />
              <span className="max-w-[8rem] truncate text-foreground">{c.display_name}</span>
            </Link>
          ))}
        </span>
      </span>
    </div>
  );
}
