// 최근 본 공고 / 최근 검색어 — 클라이언트 localStorage 기반(로그인 불필요, 기기 로컬).
// 즉시 동작하는 편의 기능(서버 저장 없음).

const JOBS_KEY = "recentJobs";
const SEARCHES_KEY = "recentSearches";
const JOBS_CAP = 12;
const SEARCHES_CAP = 8;

export type RecentJob = {
  id: string;
  title: string; // 표시용(한글 제목 우선 저장)
  company: string;
  slug: string; // 회사 로고용
  ts: number;
};

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, arr: T[], cap: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(arr.slice(0, cap)));
  } catch {
    /* 용량 초과 등 무시 */
  }
}

export function getRecentJobs(): RecentJob[] {
  return read<RecentJob>(JOBS_KEY);
}

export function pushRecentJob(job: Omit<RecentJob, "ts">): void {
  if (!job.id) return;
  const next = [{ ...job, ts: Date.now() }, ...getRecentJobs().filter((j) => j.id !== job.id)];
  write(JOBS_KEY, next, JOBS_CAP);
}

export function getRecentSearches(): string[] {
  // 외부에서 손상된 값(비문자 요소)도 방어 — 이후 toLowerCase 등에서 throw 방지.
  return read<unknown>(SEARCHES_KEY).filter((t): t is string => typeof t === "string");
}

export function pushRecentSearch(q: string): void {
  const term = q.trim();
  if (!term) return;
  const next = [term, ...getRecentSearches().filter((t) => t.toLowerCase() !== term.toLowerCase())];
  write(SEARCHES_KEY, next, SEARCHES_CAP);
}

export function clearRecentJobs(): void {
  write(JOBS_KEY, [], JOBS_CAP);
}

export function clearRecentSearches(): void {
  write(SEARCHES_KEY, [], SEARCHES_CAP);
}
