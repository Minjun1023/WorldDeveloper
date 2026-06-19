import Link from "next/link";

import { CompanyDirectoryControls } from "@/components/company/CompanyDirectoryControls";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Pagination } from "@/components/search/Pagination";
import { fetchCompanies } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { companyBlurb } from "@/lib/company-blurb";
import { companyProfile, flagEmoji } from "@/lib/company-profiles";
import { isoFromLocation } from "@/lib/flags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20; // 20개 기업 단위로 페이지네이션

type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// 기업 디렉터리 — 컬럼 리스트(기업 | 분야 | 지역 | 채용중 공고) + 상단 검색·분야·정렬 컨트롤.
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const tag = str(searchParams.tag);
  const q = str(searchParams.q);
  const sort = str(searchParams.sort) ?? "jobs"; // jobs(공고 많은 순) | name(이름순)
  // 전체를 받아 분야 칩을 집계하고, 선택된 분야/검색/정렬은 서버 JS 로 적용한다.
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
    // 행 한 줄 소개: 수기 설명 → (없으면) 한국어 업종. 태그/위치는 전용 컬럼이 있어 넘기지 않음.
    const blurb = companyBlurb(c.slug);
    return { c, location, flag, countryCode, bare, blurb };
  });
  const allVisible = enriched.filter((e) => !e.bare);

  // 분야 옵션: 노출 기업들의 태그를 빈도순으로 집계. 카운트 동봉.
  const tagCounts = new Map<string, number>();
  for (const e of allVisible) {
    for (const t of e.c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tagOptions = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));
  if (tag && !tagOptions.some((o) => o.value === tag)) {
    tagOptions.unshift({ value: tag, label: tag, count: 0 });
  }

  // 분야 + 회사명 검색으로 좁히기.
  let visible = tag ? allVisible.filter((e) => (e.c.tags ?? []).includes(tag)) : allVisible;
  if (q) {
    const ql = q.toLowerCase();
    visible = visible.filter((e) => e.c.display_name.toLowerCase().includes(ql));
  }
  // 정렬: 기본 공고 많은 순, 이름순 옵션.
  visible =
    sort === "name"
      ? [...visible].sort((a, b) => a.c.display_name.localeCompare(b.c.display_name))
      : [...visible].sort((a, b) => b.c.job_count - a.c.job_count);

  // 20개 단위 페이지네이션. 검색·분야·정렬 변경 시엔 useUpdateQuery 가 page 를 1 로 리셋.
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1">기업 디렉터리</h1>
          <span className="shrink-0 whitespace-nowrap pt-1 text-body-sm font-semibold text-muted-foreground">
            {visible.length.toLocaleString()}개 기업
          </span>
        </div>
        <p className="text-body-sm text-muted-foreground">
          해외 취업 비자를 지원하는 글로벌 테크 기업들을 모았어요.
        </p>
      </div>

      {/* 검색 + 분야 + 정렬 */}
      {data && <CompanyDirectoryControls tagOptions={tagOptions} />}

      {!data ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          기업 목록을 불러오지 못했습니다.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          {q ? `'${q}' 검색 결과가 없습니다.` : "해당 조건의 기업이 없습니다."}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            {/* 컬럼 헤더 (md+) */}
            <div className="hidden items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-caption font-medium text-muted-foreground md:flex">
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
              <span className="flex-1">기업</span>
              <span className="hidden w-44 shrink-0 lg:block">분야</span>
              <span className="hidden w-28 shrink-0 sm:block">지역</span>
              <span className="w-20 shrink-0 whitespace-nowrap text-right">채용중 공고</span>
            </div>

            {pageItems.map((e, i) => {
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

          <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} />
        </>
      )}
    </div>
  );
}
