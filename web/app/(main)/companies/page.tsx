import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { CompanyTagFilter } from "@/components/company/CompanyTagFilter";
import { Pagination } from "@/components/search/Pagination";
import { fetchCompanies } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { companyProfile } from "@/lib/company-profiles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20; // 20개 기업 단위로 페이지네이션

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
    const hasTags = !!(c.tags && c.tags.length > 0);
    const description =
      profile?.description ?? (hasTags ? `${c.tags!.slice(0, 3).join(" · ")} 분야` : null);
    // '내용 없는' 희소 기업은 디렉터리에서만 숨긴다(공고는 검색/추천에 남음).
    const bare = !location && !hasTags && !description && c.job_count <= 1;
    return { c, location, bare };
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

  // 20개 단위 페이지네이션. 분야 변경 시엔 CompanyTagFilter 가 page 없는 URL 로 이동하므로 자동 리셋.
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {!data ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          기업 목록을 불러오지 못했습니다.
        </div>
      ) : (
        <>
          {/* 상단 바: 개수 + 분야(카테고리) 필터 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-muted-foreground">
              기업 <span className="font-semibold text-foreground">{visible.length.toLocaleString()}</span>개
            </p>
            {tagOptions.length > 0 && (
              <div className="w-full sm:w-56">
                <CompanyTagFilter
                  options={tagOptions}
                  selected={tag ?? null}
                  placeholder="전체 분야"
                  variant="input"
                />
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-body-sm text-muted-foreground">
              해당 조건의 기업이 없습니다.
            </div>
          ) : (
            <>
              {/* 기업 카드 그리드 (Figma '검증된 기업' 카드 스타일) */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((e) => {
                  const { c, location } = e;
                  const subline = [(c.tags ?? []).slice(0, 2).join(" · "), location]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Link
                      key={c.slug}
                      href={`/companies/${c.slug}`}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
                    >
                      <CompanyLogo slug={c.slug} name={c.display_name} size={48} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground group-hover:text-primary">
                          {c.display_name}
                        </span>
                        {subline && (
                          <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                            {subline}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-body-sm font-bold tabular-nums text-primary">{c.job_count}개</div>
                        <div className="text-caption text-muted-foreground">공고</div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} />
            </>
          )}
        </>
      )}
    </div>
  );
}
