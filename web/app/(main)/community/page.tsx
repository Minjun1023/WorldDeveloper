import { Building2, FileText, MessageSquare, PenSquare, Stamp, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { CATEGORIES, categoryLabel, fetchCommunityPosts, sourceLabel } from "@/lib/community";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "커뮤니티 — WorldDeveloper",
  description: "해외취업을 준비하는 개발자들이 비자·면접·연봉·정착 정보를 나누는 공간.",
};

type SearchParams = { [key: string]: string | string[] | undefined };

// 빈 보드에서 첫 글을 유도하는 예시(카테고리 프리필).
const EXAMPLE_PROMPTS = [
  { category: "interview", label: "이 회사 면접 어땠나요?" },
  { category: "visa", label: "비자 발급 후기" },
  { category: "salary", label: "연봉·협상 팁" },
  { category: "settle", label: "이주·정착 질문" },
  { category: "qna", label: "아무거나 물어보기" },
];

// 준비에 도움되는 실데이터 페이지(예전 BETA 안내의 좋은 부분을 사이드바로).
const GUIDES = [
  { href: "/visa", icon: Stamp, label: "비자 가이드", desc: "국가별 비자·스폰서십" },
  { href: "/companies", icon: Building2, label: "회사 정보", desc: "명부 검증 회사·업종" },
  { href: "/coach", icon: FileText, label: "이력서 코치", desc: "공고 맞춤 1:1 상담" },
];

function qs(category?: string, sort?: string, page?: number): string {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (sort && sort !== "recent") p.set("sort", sort);
  if (page && page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/community?${s}` : "/community";
}

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const category = typeof searchParams.category === "string" ? searchParams.category : undefined;
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "recent";
  const page = Math.max(1, Number(typeof searchParams.page === "string" ? searchParams.page : "1") || 1);
  const [{ items, has_more }, popularRes] = await Promise.all([
    fetchCommunityPosts({ category, sort, page: page - 1 }),
    fetchCommunityPosts({ sort: "top" }),
  ]);
  const popular = popularRes.items.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 카테고리 탭 + 정렬 + 글쓰기 (제목 없는 툴바형 상단) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <nav className="flex flex-wrap gap-1.5">
          <Tab href={qs(undefined, sort)} active={!category}>전체</Tab>
          {CATEGORIES.map((c) => (
            <Tab key={c.key} href={qs(c.key, sort)} active={category === c.key}>
              {c.label}
            </Tab>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 text-caption">
            <Link href={qs(category, "recent")} className={cn(sort !== "top" ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>최신</Link>
            <span className="text-border">·</span>
            <Link href={qs(category, "top")} className={cn(sort === "top" ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>인기</Link>
          </div>
          <Link
            href="/community/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-body-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            글쓰기
          </Link>
        </div>
      </div>

      {/* 2단: 목록 + 사이드바 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center sm:p-12">
              <p className="text-body font-medium text-foreground">아직 글이 없어요</p>
              <p className="mx-auto mt-1.5 max-w-md text-body-sm text-muted-foreground">
                첫 글을 남겨 라운지를 열어주세요. 작은 경험·질문 하나가 누군가에겐 큰 도움이 돼요.
              </p>
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
              <Link href="/community/new" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground hover:opacity-90">
                첫 글 쓰기
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/community/${p.id}`} className="group block rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-2 text-caption text-muted-foreground">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-foreground">{categoryLabel(p.category)}</span>
                      <span className="rounded-full border border-border px-2 py-0.5">{sourceLabel(p.source_type)}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-foreground transition-colors group-hover:text-primary">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">{p.excerpt}</p>
                    <div className="mt-2.5 flex items-center gap-3 text-caption text-muted-foreground">
                      <span className="font-medium">{p.author_handle}</span>
                      <span>{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                      <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{p.score}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{p.comment_count}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 페이지네이션 (이전/다음) — 백엔드 has_more 기반 */}
          {(page > 1 || has_more) && (
            <nav className="flex items-center justify-center gap-3 pt-2" aria-label="페이지 이동">
              {page > 1 ? (
                <Link href={qs(category, sort, page - 1)} className="rounded-lg border border-border px-4 py-2 text-body-sm text-foreground transition-colors hover:bg-accent">← 이전</Link>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-body-sm text-muted-foreground opacity-40">← 이전</span>
              )}
              <span className="text-body-sm tabular-nums text-muted-foreground">{page} 페이지</span>
              {has_more ? (
                <Link href={qs(category, sort, page + 1)} className="rounded-lg border border-border px-4 py-2 text-body-sm text-foreground transition-colors hover:bg-accent">다음 →</Link>
              ) : (
                <span className="rounded-lg border border-border px-4 py-2 text-body-sm text-muted-foreground opacity-40">다음 →</span>
              )}
            </nav>
          )}
        </div>

        {/* 사이드바 */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {popular.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-body-sm font-semibold text-foreground">인기 글</h2>
              <ul className="mt-3 space-y-2.5">
                {popular.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/community/${p.id}`} className="group flex gap-2">
                      <span className="text-caption font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="line-clamp-2 text-body-sm text-muted-foreground transition-colors group-hover:text-foreground">{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-body-sm font-semibold text-foreground">준비에 도움되는 것</h2>
            <ul className="mt-2 space-y-0.5">
              {GUIDES.map((g) => {
                const Icon = g.icon;
                return (
                  <li key={g.href}>
                    <Link href={g.href} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-body-sm font-medium text-foreground">{g.label}</span>
                        <span className="block text-caption text-muted-foreground">{g.desc}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
