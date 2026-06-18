/**
 * 커뮤니티(해외취업 라운지) 서버 페치 + 타입.
 * 읽기는 공개라 BACKEND_URL 직접 호출. 쓰기는 클라이언트가 /api/community/* 프록시로(토큰 전달).
 */
import { flagFromLocation } from "@/lib/flags";

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

// linked_country(=비자 가이드 국가 슬러그) → 한국어 라벨. 국기는 flags.regionFlag 재사용(모르면 "").
const COUNTRY_LABEL: Record<string, string> = {
  germany: "독일", netherlands: "네덜란드", uk: "영국", ireland: "아일랜드",
  japan: "일본", singapore: "싱가포르", usa: "미국", us: "미국", canada: "캐나다",
  france: "프랑스", spain: "스페인", australia: "호주", sweden: "스웨덴",
};
export function countryLabel(slug: string): string {
  return COUNTRY_LABEL[slug] ?? slug;
}
export function countryFlag(slug: string): string {
  return flagFromLocation(slug);
}

// 비자 종류로 인정하는 태그 어휘(소문자 매칭). facet 의 태그 중 이 목록에 든 것만 "비자 종류" 카드에 노출.
export const VISA_TAG_VOCAB = new Set([
  "blue card", "eu blue card", "ep", "s pass", "skilled worker", "hsm",
  "h-1b", "h1b", "opt", "cpt", "l-1", "o-1", "tn", "green card", "ica",
  "critical skills", "hpi", "global talent", "ict", "working holiday",
  "kennismigrant", "highly skilled migrant", "30% ruling",
]);
export function isVisaTag(tag: string): boolean {
  return VISA_TAG_VOCAB.has(tag.trim().toLowerCase());
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
  tags: string[];
  comment_count: number;
  score: number;
  view_count: number;
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
  tags: string[];
  comment_count: number;
  score: number;
  view_count: number;
  viewer_reacted: boolean;
  mine: boolean;
  created_at: string;
  comments: CommunityComment[];
};

export type CommunityListResponse = { items: CommunityPostSummary[]; has_more: boolean };

export type CommunityFacetCount = { key: string; count: number };
export type CommunityFacets = {
  categories: CommunityFacetCount[];
  countries: CommunityFacetCount[];
  tags: CommunityFacetCount[];
};

export async function fetchCommunityPosts(params: {
  category?: string;
  company?: string;
  country?: string;
  jobId?: string;
  tag?: string;
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
  if (params.tag) url.searchParams.set("tag", params.tag);
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

export async function fetchCommunityFacets(): Promise<CommunityFacets> {
  const empty: CommunityFacets = { categories: [], countries: [], tags: [] };
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/facets`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as Partial<CommunityFacets>;
    return {
      categories: data.categories ?? [],
      countries: data.countries ?? [],
      tags: data.tags ?? [],
    };
  } catch {
    return empty;
  }
}

export function facetCount(list: CommunityFacetCount[], key: string): number {
  return list.find((c) => c.key === key)?.count ?? 0;
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
