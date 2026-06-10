import { CoachChat } from "@/components/coach/CoachChat";
import { getSessionToken } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type PickJob = { id: string; title: string; company: { display_name: string } };

// 두 호출은 picker 를 채우기 위한 보조 데이터일 뿐 — 코치 페이지 렌더를 막아선 안 된다.
// 병렬 실행 + 각자 타임아웃으로 추천 서버가 느리거나 죽어도 페이지가 즉시 뜨게 한다.
// (추천은 저장 공고가 없는 콜드스타트 사용자의 picker 를 채우므로, 정상 지연(~1s)엔
//  걸리지 않게 8s 로 넉넉히 — 단 과거의 ~30s hang 은 확실히 차단.)
async function fetchSavedJobs(token: string): Promise<PickJob[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/saved`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as PickJob[]) : [];
  } catch {
    return [];
  }
}

async function fetchRecommendedJobs(token: string): Promise<PickJob[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/recommend/me`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ note: null }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { recommendations: { job: PickJob }[] };
    return (data.recommendations ?? []).map((r) => r.job);
  } catch {
    return [];
  }
}

async function fetchPickJobs(token: string): Promise<PickJob[]> {
  const [saved, recommended] = await Promise.all([fetchSavedJobs(token), fetchRecommendedJobs(token)]);
  const seen = new Map<string, PickJob>();
  for (const j of saved) seen.set(j.id, j); // 저장 공고 우선
  for (const j of recommended) if (!seen.has(j.id)) seen.set(j.id, j);
  return [...seen.values()];
}

export default async function CoachPage() {
  const token = await getSessionToken();
  const jobs = token ? await fetchPickJobs(token) : [];
  return <CoachChat initialJobs={jobs} />;
}
