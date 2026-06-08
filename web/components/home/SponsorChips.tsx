import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// 검증 회사 신뢰 칩: "검증 회사" 라벨 + 회사 로고 + 이름(인라인). Readdy 목업 대응.
// companies 가 비면 렌더링하지 않음.
export function SponsorChips({ companies }: { companies: CompanySummary[] }) {
  if (companies.length === 0) return null;

  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-body-sm">
      <span className="text-muted-foreground">검증 회사</span>
      {companies.map((c) => (
        <Link
          key={c.slug}
          href={`/companies/${c.slug}`}
          title={c.display_name}
          className="flex items-center gap-2 font-medium text-foreground transition-opacity hover:opacity-70"
        >
          <CompanyLogo slug={c.slug} name={c.display_name} size={24} />
          <span className="max-w-[8rem] truncate">{c.display_name}</span>
        </Link>
      ))}
    </div>
  );
}
