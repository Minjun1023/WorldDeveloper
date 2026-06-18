/**
 * 커뮤니티(해외취업 라운지) 서버 페치 + 타입.
 * 읽기는 공개라 BACKEND_URL 직접 호출. 쓰기는 클라이언트가 /api/community/* 프록시로(토큰 전달).
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export const CATEGORIES = [
  { key: "visa", label: "비자·이민" },
  { key: "interview", label: "면접 후기" },
  { key: "salary", label: "연봉·협상" },
  { key: "settle", label: "이주·정착" },
  { key: "company", label: "회사 후기" },
  { key: "qna", label: "Q&A" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const SOURCE_TYPES = [
  { key: "experience", label: "직접 경험" },
  { key: "secondhand", label: "전해 들음" },
  { key: "question", label: "질문" },
] as const;

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
export function sourceLabel(key: string): string {
  return SOURCE_TYPES.find((s) => s.key === key)?.label ?? key;
}

// 카테고리별 색상(스캔성). chip=칩 배경+글자, dot=점. 다크 대응.
export const CATEGORY_STYLE: Record<string, { chip: string; dot: string }> = {
  visa: { chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  interview: { chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  salary: { chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  settle: { chip: "bg-teal-500/10 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  company: { chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  qna: { chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300", dot: "bg-slate-500" },
};
export function categoryStyle(key: string): { chip: string; dot: string } {
  return CATEGORY_STYLE[key] ?? { chip: "bg-surface-2 text-foreground", dot: "bg-muted-foreground" };
}

export type CommunityComment = {
  id: string;
  author_handle: string;
  anonymous: boolean;
  body: string;
  mine: boolean;
  created_at: string;
};

export type CommunityPostSummary = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  author_handle: string;
  anonymous: boolean;
  source_type: string;
  linked_company_slug: string | null;
  linked_country: string | null;
  linked_job_id: string | null;
  comment_count: number;
  score: number;
  created_at: string;
};

export type CommunityPostDetail = {
  id: string;
  category: string;
  title: string;
  body: string;
  author_handle: string;
  anonymous: boolean;
  source_type: string;
  source_url: string | null;
  linked_company_slug: string | null;
  linked_job_id: string | null;
  linked_country: string | null;
  comment_count: number;
  score: number;
  viewer_reacted: boolean;
  mine: boolean;
  created_at: string;
  comments: CommunityComment[];
};

export type CommunityListResponse = { items: CommunityPostSummary[]; has_more: boolean };

export async function fetchCommunityPosts(params: {
  category?: string;
  company?: string;
  country?: string;
  jobId?: string;
  q?: string;
  unanswered?: boolean;
  sort?: string;
  page?: number;
} = {}): Promise<CommunityListResponse> {
  const url = new URL(`${BACKEND_URL}/api/v1/community/posts`);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.company) url.searchParams.set("company", params.company);
  if (params.country) url.searchParams.set("country", params.country);
  if (params.jobId) url.searchParams.set("jobId", params.jobId);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.unanswered) url.searchParams.set("unanswered", "true");
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.page) url.searchParams.set("page", String(params.page));
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { items: [], has_more: false };
    return (await res.json()) as CommunityListResponse;
  } catch {
    return { items: [], has_more: false };
  }
}

export async function fetchCommunityPost(
  id: string,
  token?: string | null,
): Promise<CommunityPostDetail | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/posts/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CommunityPostDetail;
  } catch {
    return null;
  }
}
