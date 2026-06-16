import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { CompanyTagFilter } from "@/components/company/CompanyTagFilter";
import { fetchCompanies } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { companyProfile, flagEmoji } from "@/lib/company-profiles";
import { isoFromLocation } from "@/lib/flags";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

// 기업 디렉터리 — 직행 '기업' 페이지처럼 컬럼 리스트(기업 | 분야 | 지역 | 채용중 공고).
// 상단 분야(카테고리) 드롭다운으로 탐색 — 실데이터 태그 기반(추정/조회수 없음).
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  // 전체를 받아 분야 칩을 집계하고, 선택된 분야는 클라/서버 JS 필터로 좁힌다.
  const data = await fetchCompanies();

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
    // 행에 표시할 한 줄 소개는 큐레이션 설명만(태그 기반 폴백은 분야 컬럼과 중복이라 제외).
    const blurb = profile?.description ?? null;
    return { c, location, flag, countryCode, bare, blurb };
  });
  const allVisible = enriched.filter((e) => !e.bare);

  // 분야 옵션: 노출 기업들의 태그를 빈도순으로 집계(전부, 드롭다운은 스크롤). 카운트 동봉.
  const tagCounts = new Map<string, number>();
  for (const e of allVisible) {
    for (const t of e.c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tagOptions = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));
  // 선택된 분야가 옵션에 없으면(0건 등) 표시되도록 끼워 넣는다.
  if (tag && !tagOptions.some((o) => o.value === tag)) {
    tagOptions.unshift({ value: tag, label: tag, count: 0 });
  }

  // 선택된 분야로 좁히기(정확 일치).
  const visible = tag ? allVisible.filter((e) => (e.c.tags ?? []).includes(tag)) : allVisible;

  return (
    <div className="space-y-4">
      {/* 분야 필터 — 작은 화면 폴백(헤더가 숨는 lg 미만). lg+ 는 헤더 '분야' 컬럼에 위치. */}
      {tagOptions.length > 0 && (
        <div className="lg:hidden">
          <CompanyTagFilter
            options={tagOptions}
            selected={tag ?? null}
            placeholder="전체 분야"
            variant="input"
          />
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
              {/* 분야 컬럼 헤더 = 분야 필터(드롭다운). 헤더 자리에서 바로 거르기. */}
              <div className="hidden w-44 shrink-0 lg:block">
                {tagOptions.length > 0 ? (
                  <CompanyTagFilter
                    options={tagOptions}
                    selected={tag ?? null}
                    placeholder="분야"
                    variant="header"
                  />
                ) : (
                  <span>분야</span>
                )}
              </div>
              <span className="hidden w-28 shrink-0 sm:block">지역</span>
              <span className="w-20 shrink-0 whitespace-nowrap text-right">채용중 공고</span>
            </div>

            {visible.map((e, i) => {
              const { c, location, flag, countryCode, blurb } = e;
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
                    {/* 큐레이션 한 줄 소개 (있는 회사만) — 데스크톱에서 이름 아래로 */}
                    {blurb && (
                      <span className="mt-0.5 hidden truncate text-caption text-muted-foreground sm:block">
                        {blurb}
                      </span>
                    )}
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
                  {/* 채용중 공고 수 */}
                  <div className="w-20 shrink-0 text-right text-body-sm">
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
