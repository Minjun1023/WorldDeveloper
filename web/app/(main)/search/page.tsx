export const metadata = {
  title: "공고 검색 — 비자 스폰서십 해외 개발자 채용 | DevPass",
  description: "비자 스폰서십이 검증된 해외 개발자 공고를 국가·직무·연봉으로 검색하세요.",
};

import { JobRow } from "@/components/job/JobRow";
import { groupAdjacentJobs } from "@/lib/group-jobs";
import { SearchFilterLayout } from "@/components/search/SearchFilterLayout";
import { Pagination } from "@/components/search/Pagination";
import { RecentSearches } from "@/components/search/RecentSearches";
import { RecordSearch } from "@/components/search/RecordSearch";
import { SearchBar } from "@/components/search/SearchBar";
import { SortToggle } from "@/components/search/SortToggle";
import { fetchJobs, fetchRegions, fetchSavedJobIds } from "@/lib/api";
import { getSession, getSessionToken } from "@/lib/session-server";

// force-dynamic 제거 — 이 페이지는 searchParams + 쿠키(getSession/Token)를 읽어 어차피 요청마다
// 동적 렌더된다. force-dynamic 은 모든 fetch 를 no-store 로 덮어써 fetchRegions 의 revalidate 를
// 무력화했으므로 제거. 검색 결과(fetchJobs)·저장 ID(fetchSavedJobIds)는 각자 no-store 라 신선 유지,
// 레퍼런스(fetchRegions)만 캐시된다.
const PAGE_SIZE = 20;

type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = str(searchParams.q);
  const visa = str(searchParams.visa);
  const location = str(searchParams.location);
  const region = str(searchParams.region);
  const remote = searchParams.remote === "true" ? true : undefined;
  const page = Number(searchParams.page) || 1;
  const sort = str(searchParams.sort) ?? (q ? "relevance" : "recent");
  const discipline = str(searchParams.discipline);
  const track = str(searchParams.track);
  const verifiedOnly = searchParams.verified_only === "true";
  const minSalary = Number(searchParams.min_salary) || undefined;
  const complete = searchParams.complete === "true";

  const [result, regions, session, token] = await Promise.all([
    fetchJobs({ q, visa, location, region, remote, sort, discipline, track, verifiedOnly, minSalary, complete, page, pageSize: PAGE_SIZE }),
    fetchRegions(),
    getSession(),
    getSessionToken(),
  ]);
  const loggedIn = !!session;
  // 재접속 시에도 관심(저장) 공고 하트가 채워져 보이도록 — 저장 ID 집합을 서버에서 1회 조회.
  const savedIds = token ? await fetchSavedJobIds(token) : new Set<string>();

  return (
    <div className="space-y-6">
      <h1 className="sr-only">개발자 채용 공고 검색</h1>
      {/* 키워드 검색 1건 기록(인기 검색어용). 백엔드가 검색자/일 dedup. */}
      {q ? <RecordSearch term={q} /> : null}

      <section className="space-y-3">
        <SearchBar />
        <RecentSearches />
      </section>

      <SearchFilterLayout regions={regions}>
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {result.ok ? (
              <p className="text-body-sm text-muted-foreground">
                총 <span className="font-semibold text-foreground">{result.data.total.toLocaleString()}</span>개 공고
              </p>
            ) : (
              <span />
            )}
            {/* 검색 조건 알림(SearchAlertButton)은 관심 기업 알림으로 대체되어 UI 에서 내림 —
                백엔드 구독/발송 인프라와 기존 구독자 메일은 유지된다. */}
            <div className="flex items-center gap-2">
              <SortToggle />
            </div>
          </div>

          {!result.ok ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
              백엔드에 연결할 수 없습니다 ({result.error}).
              <br />
              <code className="font-mono text-foreground">cd backend &amp;&amp; ./gradlew bootRun</code>{" "}
              으로 실행하세요.
            </div>
          ) : result.data.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
              조건에 맞는 공고가 없습니다. 필터를 조정해보세요.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {groupAdjacentJobs(result.data.items).map(({ job, extraLocations }) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    loggedIn={loggedIn}
                    saved={savedIds.has(job.id)}
                    extraLocations={extraLocations}
                  />
                ))}
              </div>
              <Pagination
                page={result.data.page}
                pageSize={result.data.page_size}
                total={result.data.total}
              />
            </>
          )}
        </section>
      </SearchFilterLayout>
    </div>
  );
}
