import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// 히어로 우측 비주얼: 실제 정부 명부로 검증된 회사들의 로고 월.
// (기존 6차원 매칭 미리보기는 아래 추천 섹션과 중복이라 교체.) 스톡 이미지 대신
// 우리가 보유한 실데이터(검증 회사 로고)로 신뢰를 시각화한다.
export function HeroVisual({
  companies,
  totalVerified,
}: {
  companies: CompanySummary[];
  totalVerified: number;
}) {
  if (companies.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-1.5 text-caption font-semibold text-primary">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        정부 명부로 검증된 회사
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {companies.map((c) => (
          <div
            key={c.slug}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-3"
          >
            <CompanyLogo slug={c.slug} name={c.display_name} size={36} />
            <span className="w-full truncate text-center text-caption text-muted-foreground">
              {c.display_name}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
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
