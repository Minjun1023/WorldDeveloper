import {
  Building2,
  ClipboardList,
  Coins,
  Eye,
  Globe2,
  HelpCircle,
  LayoutGrid,
  MessageSquare,
  PenSquare,
  Search,
  Stamp,
  ThumbsUp,
} from "lucide-react";
import type { ComponentType } from "react";
import Link from "next/link";

import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";
import {
  CATEGORIES,
  categoryLabel,
  categoryStyle,
  countryFlag,
  countryLabel,
  facetCount,
  fetchCommunityFacets,
  fetchCommunityPosts,
  sourceLabel,
} from "@/lib/community";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "커뮤니티 — WorldDeveloper",
  description: "해외취업을 준비하는 개발자들이 비자·면접·연봉·정착 정보를 나누는 공간.",
};

type SearchParams = { [key: string]: string | string[] | undefined };

const CATEGORY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  visa: Stamp,
  interview: ClipboardList,
  salary: Coins,
  settle: Globe2,
  company: Building2,
  qna: HelpCircle,
};

const EXAMPLE_PROMPTS = [
  { category: "interview", label: "이 회사 면접 어땠나요?" },
  { category: "visa", label: "비자 발급 후기" },
  { category: "salary", label: "연봉·협상 팁" },
  { category: "settle", label: "이주·정착 질문" },
  { category: "qna", label: "아무거나 물어보기" },
];

const SORTS = [
  { key: "recent", label: "최신" },
  { key: "top", label: "인기" },
  { key: "comments", label: "댓글순" },
];

type QsArgs = {
  category?: string;
  sort?: string;
  page?: number;
  q?: string;
  unanswered?: boolean;
  country?: string;
  tag?: string;
};
function qs(o: QsArgs): string {
  const p = new URLSearchParams();
  if (o.category) p.set("category", o.category);
  if (o.sort && o.sort !== "recent") p.set("sort", o.sort);
  if (o.page && o.page > 1) p.set("page", String(o.page));
  if (o.q) p.set("q", o.q);
  if (o.unanswered) p.set("unanswered", "1");
  if (o.country) p.set("country", o.country);
  if (o.tag) p.set("tag", o.tag);
  const s = p.toString();
  return s ? `/community?${s}` : "/community";
}

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const category = typeof searchParams.category === "string" ? searchParams.category : undefined;
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "recent";
  const q = typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined;
  const country = typeof searchParams.country === "string" ? searchParams.country : undefined;
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  const unanswered = searchParams.unanswered === "1" || searchParams.unanswered === "true";
  const page = Math.max(1, Number(typeof searchParams.page === "string" ? searchParams.page : "1") || 1);

  const [{ items, has_more }, facets] = await Promise.all([
    fetchCommunityPosts({ category, sort, q, country, tag, unanswered, page: page - 1 }),
    fetchCommunityFacets(),
  ]);
  const totalCount = facets.categories.reduce((sum, c) => sum + c.count, 0);
  const hasFilter = !!(q || unanswered || country || tag);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 text-foreground">커뮤니티</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            해외취업을 준비하고 경험한 개발자들이 비자·면접·연봉·정착 정보를 나누는 공간.
          </p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-body-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PenSquare className="h-4 w-4" aria-hidden="true" />
          글쓰기
        </Link>
      </div>

      {/* 카테고리 탭(아이콘 + 카운트) */}
      <nav className="flex flex-wrap gap-1.5">
        <Tab href={qs({ sort, q, unanswered })} active={!category} icon={LayoutGrid} count={totalCount}>
          전체
        </Tab>
        {CATEGORIES.map((c) => (
          <Tab
            key={c.key}
            href={qs({ category: c.key, sort, q, unanswered })}
            active={category === c.key}
            icon={CATEGORY_ICON[c.key]}
            count={facetCount(facets.categories, c.key)}
          >
            {c.label}
          </Tab>
        ))}
      </nav>

      {/* 검색 + 미답변 + 정렬 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <form action="/community" method="get" className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="제목·내용 검색"
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
          {unanswered && <input type="hidden" name="unanswered" value="1" />}
        </form>

        <div className="flex items-center gap-3">
          <Link
            href={qs({ category, sort, q, country, tag, unanswered: !unanswered })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-caption font-medium transition-colors",
              unanswered ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            미답변만
          </Link>
          <div className="flex gap-1 text-caption">
            {SORTS.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-border">·</span>}
                <Link
                  href={qs({ category, sort: s.key, q, country, tag, unanswered })}
                  className={cn((sort === s.key || (s.key === "recent" && sort !== "top" && sort !== "comments")) ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {s.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 활성 필터 표시 */}
      {hasFilter && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          {q && <>&lsquo;<strong className="text-foreground">{q}</strong>&rsquo; 검색</>}
          {country && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>{countryFlag(country)}</span>
              <strong className="text-foreground">{countryLabel(country)}</strong>
            </span>
          )}
          {tag && <span>태그 <strong className="text-foreground">#{tag}</strong></span>}
          {unanswered && <span>미답변만</span>}
          <Link href={qs({ category })} className="text-primary hover:underline">초기화</Link>
        </p>
      )}

      {/* 2단: 목록 + 사이드바 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center sm:p-12">
              <p className="text-body font-medium text-foreground">
                {hasFilter ? "조건에 맞는 글이 없어요" : "아직 글이 없어요"}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-body-sm text-muted-foreground">
                {hasFilter
                  ? "다른 검색어나 필터로 다시 시도해 보세요."
                  : "첫 글을 남겨 라운지를 열어주세요. 작은 경험·질문 하나가 누군가에겐 큰 도움이 돼요."}
              </p>
              {!hasFilter && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <Link
                      key={p.label}
                      href={`/community/new?category=${p.category}`}
                      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/community/new" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground hover:opacity-90">
                글쓰기
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/community/${p.id}`} className="group block rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", categoryStyle(p.category).chip)}>{categoryLabel(p.category)}</span>
                      {p.linked_country && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                          <span aria-hidden>{countryFlag(p.linked_country)}</span>
                          {countryLabel(p.linked_country)}
                        </span>
                      )}
                      <span className="rounded-full border border-border px-2 py-0.5">{sourceLabel(p.source_type)}</span>
                      {p.category === "qna" && p.comment_count === 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">답변 대기</span>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-foreground transition-colors group-hover:text-primary">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">{p.excerpt}</p>
                    {p.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted-foreground">#{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-caption text-muted-foreground">
                      <CommunityAvatar name={p.author_handle} size={20} />
                      <span className="font-medium text-foreground">{p.author_handle}</span>
                      <span aria-hidden>·</span>
                      <span>{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                      <span className="ml-auto flex items-center gap-3">
                        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{p.score}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{p.comment_count}</span>
                        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{p.view_count}</span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 페이지네이션 */}
          {(page > 1 || has_more) && (
            <nav className="flex items-center justify-center gap-3 pt-2" aria-label="페이지 이동">
              {page > 1 ? (
                <Link href={qs({ category, sort, q, country, tag, unanswered, page: page - 1 })} className="rounded-lg border border-border px-4 py-2 text-body-sm text-foreground transition-colors hover:bg-accent">← 이전</Link>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-body-sm text-muted-foreground opacity-40">← 이전</span>
              )}
              <span className="text-body-sm tabular-nums text-muted-foreground">{page} 페이지</span>
              {has_more ? (
                <Link href={qs({ category, sort, q, country, tag, unanswered, page: page + 1 })} className="rounded-lg border border-border px-4 py-2 text-body-sm text-foreground transition-colors hover:bg-accent">다음 →</Link>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-body-sm text-muted-foreground opacity-40">다음 →</span>
              )}
            </nav>
          )}
        </div>

        <CommunitySidebar facets={facets} />
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  icon: Icon,
  count,
  children,
}: {
  href: string;
  active: boolean;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
      {typeof count === "number" && count > 0 && (
        <span className={cn("tabular-nums text-caption", active ? "text-primary-foreground/80" : "text-muted-foreground/70")}>{count}</span>
      )}
    </Link>
  );
}
