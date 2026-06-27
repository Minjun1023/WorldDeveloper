/**
 * Spring 백엔드 호출 클라이언트.
 * 환경 변수 BACKEND_URL (기본 http://localhost:8080).
 */
import type {
  CompanyDetail,
  CompanyListResponse,
  InterviewPrep,
  Job,
  JobDetail,
  JobListResponse,
  JobSummary,
  VisaGuide,
} from "@/lib/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type BackendHealthResult =
  | { ok: true; service: string; timestamp: string }
  | { ok: false; error: string };

export async function fetchBackendHealth(): Promise<BackendHealthResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { service: string; timestamp: string };
    return { ok: true, service: data.service, timestamp: data.timestamp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface JobQuery {
  q?: string;
  visa?: string;
  location?: string;
  region?: string;
  remote?: boolean;
  sort?: string;
  discipline?: string;
  track?: string;
  includeUnclear?: boolean;
  verifiedOnly?: boolean;
  minSalary?: number;
  complete?: boolean;
  page?: number;
  pageSize?: number;
}

export type JobsResult =
  | { ok: true; data: JobListResponse }
  | { ok: false; error: string };

export async function fetchJobs(query: JobQuery = {}): Promise<JobsResult> {
  const url = new URL(`${BACKEND_URL}/api/v1/jobs`);
  if (query.q) url.searchParams.set("q", query.q);
  if (query.visa) url.searchParams.set("visa", query.visa);
  if (query.location) url.searchParams.set("location", query.location);
  if (query.region) url.searchParams.set("region", query.region);
  if (query.remote !== undefined) url.searchParams.set("remote", String(query.remote));
  if (query.sort) url.searchParams.set("sort", query.sort);
  if (query.discipline) url.searchParams.set("discipline", query.discipline);
  if (query.track) url.searchParams.set("track", query.track);
  if (query.includeUnclear) url.searchParams.set("include_unclear", "true");
  if (query.verifiedOnly) url.searchParams.set("verified_only", "true");
  if (query.minSalary) url.searchParams.set("min_salary", String(query.minSalary));
  if (query.complete) url.searchParams.set("complete", "true");
  if (query.page) url.searchParams.set("page", String(query.page));
  if (query.pageSize) url.searchParams.set("page_size", String(query.pageSize));

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as JobListResponse;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type JobResult =
  | { ok: true; data: JobDetail }
  | { ok: false; error: string; status?: number };

export async function fetchJob(id: string): Promise<JobResult> {
  // job_id 는 "source:token:native" (콜론/하이픈/영숫자) 형식이라 path 에 안전.
  // encodeURIComponent 로 콜론을 %3A 로 인코딩하면 Tomcat/Security 가 거부(400)하므로 raw 로.
  const url = `${BACKEND_URL}/api/v1/jobs/${id}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return { ok: false, error: "not found", status: 404 };
    }
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    }
    const data = (await res.json()) as JobDetail;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchInterviewPrep(id: string): Promise<InterviewPrep | null> {
  // job_id 는 raw 콜론 그대로 (fetchJob 과 동일한 이유)
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${id}/interview-prep`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as InterviewPrep;
  } catch {
    return null;
  }
}

export async function fetchVisaGuide(id: string): Promise<VisaGuide | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${id}/visa-guide`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204 || !res.ok) return null;
    return (await res.json()) as VisaGuide;
  } catch {
    return null;
  }
}

/** 캐시된 AI 요약만 가져온다(생성 안 함). SSR 기본 펼침용. 미스/오류 → null. */
export async function fetchCachedSummary(id: string, lang = "ko"): Promise<JobSummary | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/jobs/${id}/summary?lang=${lang}&cacheOnly=true`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as JobSummary;
  } catch {
    return null;
  }
}

export type RegionCount = { value: string; label: string; count: number };

export async function fetchRegions(): Promise<RegionCount[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/regions`, {
      // 국가·도시별 공고 수는 일 단위 ETL 로만 변함 → 1시간 캐시(필터 드롭다운용).
      // 프로덕션 빌드에서 작동하며, 호출 페이지가 force-dynamic 이면 무력화된다(ISR 전환 시 활성).
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as RegionCount[];
  } catch {
    return [];
  }
}

// 서버 컴포넌트용: 최근 7일 인기 검색어(실측). 데이터 부족 시 빈 배열 → 호출부에서 큐레이션 fallback.
export async function fetchPopularSearches(limit = 8): Promise<string[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/search/popular?limit=${limit}`, {
      next: { revalidate: 300 }, // 5분 캐시 — 인기 검색어는 실시간일 필요 없음
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// 클라이언트 전용: 국가 선택 시 도시별 건수 지연 로드(Next 프록시 경유, 상대 URL).
export async function fetchRegionCities(country: string): Promise<RegionCount[]> {
  try {
    const res = await fetch(`/api/regions/cities?country=${encodeURIComponent(country)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as RegionCount[];
  } catch {
    return [];
  }
}

// 서버 컴포넌트용: 로그인 사용자의 저장(관심) 공고 ID 집합. 목록 하트 초기 상태 표시에 사용.
export async function fetchSavedJobIds(token: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/interactions`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return new Set();
    const data = (await res.json()) as { saved?: string[] };
    return new Set(Array.isArray(data.saved) ? data.saved : []);
  } catch {
    return new Set();
  }
}

// 서버 컴포넌트용: 로그인 사용자의 관심 기업 slug 집합. 기업 디렉터리 ★ 초기 상태 표시에 사용
// (행마다 클라 fetch 하지 않도록 한 번에 받아 prop 으로 내려준다).
export async function fetchFavoriteCompanySlugs(token: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/favorite-companies`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return new Set();
    const data = (await res.json()) as Array<{ slug?: string }>;
    return new Set(Array.isArray(data) ? data.map((c) => c.slug).filter((s): s is string => !!s) : []);
  } catch {
    return new Set();
  }
}

export async function fetchCompanies(tag?: string): Promise<CompanyListResponse | null> {
  const url = new URL(`${BACKEND_URL}/api/v1/companies`);
  if (tag) url.searchParams.set("tag", tag);
  try {
    // 회사 목록(+태그)은 일 단위 ETL 로만 변함 → 1시간 캐시. URL(태그)별로 따로 캐시된다.
    // 프로덕션 빌드에서 작동하며, 호출 페이지가 force-dynamic 이면 무력화된다(ISR 전환 시 활성).
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as CompanyListResponse;
  } catch {
    return null;
  }
}

export interface CompanyJobStats {
  sponsorRatio: number | null;
  verifiedCount: number;
  remoteCount: number;
}

export async function fetchCompany(
  slug: string,
  page = 1,
): Promise<
  | { company: CompanyDetail; jobs: Job[]; total: number; pageSize: number; stats: CompanyJobStats }
  | null
> {
  try {
    const [cRes, jRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/v1/companies/${slug}`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${BACKEND_URL}/api/v1/companies/${slug}/jobs?page=${page}&page_size=12`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (!cRes.ok) return null;
    const company = (await cRes.json()) as CompanyDetail;
    // 백엔드가 페이지된 목록 + 전체 집계 통계를 함께 준다(통계는 모든 공고 기준).
    const j = jRes.ok
      ? ((await jRes.json()) as {
          items: Job[];
          total: number;
          page_size: number;
          stats: { sponsor_ratio: number | null; verified_count: number; remote_count: number };
        })
      : null;
    return {
      company,
      jobs: j?.items ?? [],
      total: j?.total ?? 0,
      pageSize: j?.page_size ?? 12,
      stats: {
        sponsorRatio: j?.stats?.sponsor_ratio ?? null,
        verifiedCount: j?.stats?.verified_count ?? 0,
        remoteCount: j?.stats?.remote_count ?? 0,
      },
    };
  } catch {
    return null;
  }
}
