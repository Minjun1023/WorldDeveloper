import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// 통계 띠 아래 회사 로고 마퀴 — 디렉터리에 수록된(명부 검증) 비자 스폰서 기업명을 연속 스크롤.
// 트랙을 2배로 복제해 translateX(-50%) 로 끊김 없이 순환. 가장자리 마스크 + hover 일시정지.
export function CompanyMarquee({ companies }: { companies: CompanySummary[] }) {
  if (companies.length === 0) return null;
  const loop = [...companies, ...companies];

  return (
    <section className="border-b border-border bg-surface py-10 sm:py-12">
      <p className="text-center text-body-sm text-muted-foreground">
        디렉터리에 수록된 비자 스폰서 기업
      </p>
      <div
        className="wd-marquee-track relative mt-7 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        }}
      >
        <div className="wd-marquee flex w-max items-center gap-10 whitespace-nowrap pr-10 sm:gap-14 sm:pr-14">
          {loop.map((c, i) => (
            <Link
              key={`${c.slug}-${i}`}
              href={`/companies/${c.slug}`}
              aria-hidden={i >= companies.length}
              tabIndex={i >= companies.length ? -1 : undefined}
              className="group flex shrink-0 flex-col items-center gap-2.5"
            >
              <CompanyLogo slug={c.slug} name={c.display_name} size={44} />
              <span className="wd-logo-name text-base font-bold tracking-tight">
                {c.display_name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
