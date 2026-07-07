"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CommunityPostSummary } from "@/lib/community";

type Filter = { company?: string; country?: string; jobId?: string };

// 회사·비자·공고 페이지에 라운지 관련 글을 역노출 + 거기서 바로 글쓰기(연결값 프리필).
// 클라이언트 페치(/api/community/posts) — SSG(비자) 페이지를 정적으로 유지하기 위함.
export function RelatedCommunity({
  filter,
  writeParams,
  title = "관련 라운지 글",
  writeLabel = "글 쓰기",
}: {
  filter: Filter;
  writeParams?: Record<string, string>;
  title?: string;
  writeLabel?: string;
}) {
  const [items, setItems] = useState<CommunityPostSummary[] | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (filter.company) q.set("company", filter.company);
    if (filter.country) q.set("country", filter.country);
    if (filter.jobId) q.set("jobId", filter.jobId);
    let alive = true;
    fetch(`/api/community/posts?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => alive && setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [filter.company, filter.country, filter.jobId]);

  const writeHref =
    "/community/new" +
    (writeParams && Object.keys(writeParams).length ? `?${new URLSearchParams(writeParams).toString()}` : "");

  // 관련 글이 없으면 섹션 자체를 렌더하지 않는다 — 빈 커뮤니티 박스("아직 글이 없어요")는
  // 신규 방문자에게 죽은 기능 신호라서, 콘텐츠가 생기면 자동으로 나타나는 쪽이 낫다.
  if (items === null || items.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3">
          {title}
          <span className="ml-1.5 text-muted-foreground">{items.length}</span>
        </h2>
        <Link href={writeHref} className="shrink-0 text-body-sm font-medium text-primary hover:underline">
          {writeLabel}
        </Link>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {items.slice(0, 5).map((p) => (
          <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
            <Link href={`/community/${p.id}`} className="group block">
              <span className="block truncate text-body-sm font-medium text-foreground group-hover:text-primary">
                {p.title}
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground">
                {p.author_handle} · 추천 {p.score} · 댓글 {p.comment_count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
