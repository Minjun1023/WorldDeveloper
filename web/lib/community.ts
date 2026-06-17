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
  sort?: string;
  page?: number;
} = {}): Promise<CommunityListResponse> {
  const url = new URL(`${BACKEND_URL}/api/v1/community/posts`);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.company) url.searchParams.set("company", params.company);
  if (params.country) url.searchParams.set("country", params.country);
  if (params.jobId) url.searchParams.set("jobId", params.jobId);
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
