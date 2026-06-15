import { JobRow } from "@/components/job/JobRow";
import { Pagination } from "@/components/search/Pagination";
import { fetchRecentJobs } from "@/lib/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { [key: string]: string | string[] | undefined };

// 최근 스크랩(수집) 공고 피드 — 우리가 방금 새로 수집한 viable 공고를 first_seen_at 순으로.
export default async function RecentPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Number(searchParams.page) || 1;
  const result = await fetchRecentJobs(page, PAGE_SIZE);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">최근 수집한 공고</h1>
        <p className="mt-2 text-muted-foreground">
          방금 새로 수집한 비자 스폰서십·원격 공고를 수집 시각 순으로 보여드려요.
        </p>
      </section>

      {!result.ok ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          백엔드에 연결할 수 없습니다 ({result.error}).
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          표시할 공고가 없습니다.
        </div>
      ) : (
        <section className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            총 <span className="font-semibold text-foreground">{result.data.total}</span>개 공고
          </p>
          <div className="space-y-3">
            {result.data.items.map((job) => (
              <JobRow key={job.id} job={job} showScrapedAt />
            ))}
          </div>
          <Pagination page={result.data.page} pageSize={result.data.page_size} total={result.data.total} />
        </section>
      )}
    </div>
  );
}
