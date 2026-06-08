import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Card } from "@/components/ui/card";
import type { CompanySummary } from "@/lib/types";

// 검증된 회사 카드: 큰 로고 + 검증 방패(우상단) + 태그 + 공고 수 + "보기". Readdy 목업 대응.
export function CompanySpotlight({ companies }: { companies: CompanySummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {companies.map((c) => (
        <Link key={c.slug} href={`/companies/${c.slug}`} className="group block h-full">
          <Card className="flex h-full flex-col rounded-xl p-5 transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex items-start justify-between">
              <CompanyLogo slug={c.slug} name={c.display_name} size={52} />
              {c.verified && (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-verified"
                  style={{ backgroundColor: "color-mix(in srgb, var(--verified) 16%, transparent)" }}
                  title="정부 명부 검증 회사"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M12 2 4 5v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V5l-8-3Z" opacity="0.25" />
                    <path
                      d="M12 2 4 5v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V5l-8-3Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>

            <div className="mt-3 truncate font-semibold transition-colors group-hover:text-primary">
              {c.display_name}
            </div>

            {c.tags && c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-caption lowercase text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="min-h-4 flex-1" aria-hidden="true" />

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-body-sm">
              <span className="text-muted-foreground">공고 {c.job_count}</span>
              <span className="flex items-center gap-1 font-medium text-primary">
                보기
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
