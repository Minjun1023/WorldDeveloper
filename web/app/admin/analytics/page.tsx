import Link from "next/link";

import { getSessionToken } from "@/lib/session-server";

// 운영자 전용 분석 퍼널(가입·조회·재방문 + 인기 공고). 백엔드가 app.admin-emails 화이트리스트로 게이트.
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type TopJob = { job_id: string; title: string; views: number };
type Summary = {
  signups_total: number;
  signups_7d: number;
  views_total: number;
  views_7d: number;
  unique_viewers_7d: number;
  returning_viewers: number;
  top_jobs_7d: TopJob[];
};

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-1 text-h2 font-bold tabular-nums">{value.toLocaleString("ko-KR")}</p>
      {sub && <p className="text-caption text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const token = await getSessionToken();
  const wrap = (inner: React.ReactNode) => (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-h1">분석</h1>
      <div className="mt-6">{inner}</div>
    </div>
  );

  if (!token) {
    return wrap(
      <p className="text-body-sm text-muted-foreground">
        로그인이 필요합니다. <Link href="/signin?callbackUrl=/admin/analytics" className="text-primary underline">로그인</Link>
      </p>,
    );
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/analytics/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);

  if (!res || res.status === 403) {
    return wrap(<p className="text-body-sm text-destructive">접근 권한이 없습니다(운영자 전용).</p>);
  }
  if (!res.ok) {
    return wrap(<p className="text-body-sm text-destructive">불러올 수 없어요.</p>);
  }

  const d = (await res.json()) as Summary;

  return wrap(
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-h3">가입</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="누적 가입" value={d.signups_total} />
          <Stat label="최근 7일 가입" value={d.signups_7d} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3">조회 · 재방문</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="누적 조회" value={d.views_total} />
          <Stat label="최근 7일 조회" value={d.views_7d} />
          <Stat label="고유 열람자(7일)" value={d.unique_viewers_7d} />
          <Stat label="재방문자" value={d.returning_viewers} sub="2일 이상 방문" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3">인기 공고 (최근 7일)</h2>
        {d.top_jobs_7d.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">아직 조회 데이터가 없어요.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
            {d.top_jobs_7d.map((j, i) => (
              <li key={j.job_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-caption text-muted-foreground tabular-nums">{i + 1}</span>
                  <Link href={`/jobs/${encodeURIComponent(j.job_id)}`} className="truncate text-body-sm hover:underline">
                    {j.title}
                  </Link>
                </span>
                <span className="shrink-0 text-body-sm font-semibold tabular-nums">{j.views.toLocaleString("ko-KR")}회</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>,
  );
}
