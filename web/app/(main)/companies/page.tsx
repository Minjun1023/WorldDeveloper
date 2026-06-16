import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { fetchCompanies } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { companyProfile, flagEmoji } from "@/lib/company-profiles";
import { isoFromLocation } from "@/lib/flags";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

// 기업 디렉터리 — 직행 '기업' 페이지처럼 컬럼 리스트(기업 | 분야 | 지역 | 공고).
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  const data = await fetchCompanies(tag);

  // 위치: 큐레이션 ?? 정적 스냅샷 ?? 백엔드 파생. 국기: ISO 우선, 없으면 위치 문자열 추론.
  // '내용 없는' 희소 기업은 디렉터리에서만 숨긴다(공고는 검색/추천에 남음).
  const enriched = (data?.items ?? []).map((c) => {
    const profile = companyProfile(c.slug);
    const derived = COMPANY_LOCATIONS[c.slug];
    const location = profile?.location ?? derived?.location ?? c.location ?? null;
    const countryIso = profile?.country ?? derived?.country;
    const hasTags = !!(c.tags && c.tags.length > 0);
    const description =
      profile?.description ?? (hasTags ? `${c.tags!.slice(0, 3).join(" · ")} 분야` : null);
    const iso = countryIso ?? (location ? isoFromLocation(location) : undefined);
    const flag = iso ? flagEmoji(iso) : "";
    const countryCode = profile?.countryLabel ?? iso?.toUpperCase();
    const bare = !location && !hasTags && !description && c.job_count <= 1;
    return { c, location, flag, countryCode, bare };
  });
  const visible = enriched.filter((e) => !e.bare);

  return (
    <div className="space-y-4">
      {tag && (
        <div className="flex items-center gap-2 text-body-sm">
          <span className="text-muted-foreground">필터:</span>
          <Badge variant="default">{tag}</Badge>
          <Link href="/companies" className="text-primary hover:underline">
            전체 보기
          </Link>
        </div>
      )}

      {!data ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          기업 목록을 불러오지 못했습니다.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          해당 조건의 기업이 없습니다.
        </div>
      ) : (
        <>
          <p className="text-body-sm text-muted-foreground">
            기업 <span className="font-semibold text-foreground">{visible.length.toLocaleString()}</span>개
          </p>

          <div className="overflow-hidden rounded-lg border border-border">
            {/* 컬럼 헤더 (md+) */}
            <div className="hidden items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-caption font-medium text-muted-foreground md:flex">
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
              <span className="flex-1">기업</span>
              <span className="hidden w-44 shrink-0 lg:block">분야</span>
              <span className="hidden w-28 shrink-0 sm:block">지역</span>
              <span className="w-16 shrink-0 text-right">공고</span>
            </div>

            {visible.map((e, i) => {
              const { c, location, flag, countryCode } = e;
              return (
                <Link
                  key={c.slug}
                  href={`/companies/${c.slug}`}
                  className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <CompanyLogo slug={c.slug} name={c.display_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground group-hover:text-primary">
                      {c.display_name}
                    </span>
                    {/* 모바일: 지역을 이름 아래로 */}
                    {location && (
                      <span className="mt-0.5 block truncate text-caption text-muted-foreground sm:hidden">
                        {location}
                      </span>
                    )}
                  </div>
                  {/* 분야(태그) — lg+ */}
                  <div className="hidden w-44 shrink-0 gap-1.5 overflow-hidden lg:flex">
                    {(c.tags ?? []).slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="truncate rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {/* 지역 — sm+ */}
                  <div className="hidden w-28 shrink-0 items-center gap-1 text-caption text-muted-foreground sm:flex">
                    {flag && (
                      <span className="leading-none" aria-hidden="true">
                        {flag}
                      </span>
                    )}
                    <span className="truncate">{location ?? countryCode ?? "-"}</span>
                  </div>
                  {/* 공고 수 */}
                  <div className="w-16 shrink-0 text-right text-body-sm">
                    <span className="font-semibold text-foreground">{c.job_count}</span>
                    <span className="text-caption text-muted-foreground">개</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
