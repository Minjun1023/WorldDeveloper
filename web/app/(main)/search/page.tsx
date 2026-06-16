import { JobRow } from "@/components/job/JobRow";
import { FilterSidebar } from "@/components/search/FilterSidebar";
import { Pagination } from "@/components/search/Pagination";
import { RecentSearches } from "@/components/search/RecentSearches";
import { SearchBar } from "@/components/search/SearchBar";
import { SortToggle } from "@/components/search/SortToggle";
import { fetchJobs, fetchRegions } from "@/lib/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

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

  const [result, regions] = await Promise.all([
    fetchJobs({ q, visa, location, region, remote, sort, discipline, track, verifiedOnly, minSalary, complete, page, pageSize: PAGE_SIZE }),
    fetchRegions(),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SearchBar />
        <RecentSearches />
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <FilterSidebar regions={regions} />

        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            {result.ok ? (
              <p className="text-body-sm text-muted-foreground">
                총 <span className="font-semibold text-foreground">{result.data.total}</span>개 공고
              </p>
            ) : (
              <span />
            )}
            <SortToggle />
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
                {result.data.items.map((job) => (
                  <JobRow key={job.id} job={job} />
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
      </div>
    </div>
  );
}
