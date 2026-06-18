import { ArrowLeft, Briefcase, Eye, Globe2, Stamp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentSection } from "@/components/community/CommentSection";
import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import { CommunitySidebar } from "@/components/community/CommunitySidebar";
import { CommunityViewPing } from "@/components/community/CommunityViewPing";
import { PostInteractions } from "@/components/community/PostInteractions";
import {
  categoryLabel,
  categoryStyle,
  countryFlag,
  countryLabel,
  fetchCommunityFacets,
  fetchCommunityPost,
  sourceLabel,
} from "@/lib/community";
import { getSession, getSessionToken } from "@/lib/session-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CommunityPostPage({ params }: { params: { id: string } }) {
  const [token, session] = await Promise.all([getSessionToken(), getSession()]);
  const [post, facets] = await Promise.all([fetchCommunityPost(params.id, token), fetchCommunityFacets()]);
  if (!post) notFound();
  const loggedIn = !!session;

  return (
    <div className="space-y-5">
      <CommunityViewPing postId={post.id} />
      <Link href="/community" className="inline-flex items-center gap-1 text-body-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        라운지로
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          {/* 글 카드 */}
          <article className="space-y-4 rounded-2xl border border-border bg-surface p-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                <span className={cn("rounded-full px-2 py-0.5 font-medium", categoryStyle(post.category).chip)}>{categoryLabel(post.category)}</span>
                <span className="rounded-full border border-border px-2 py-0.5">{sourceLabel(post.source_type)}</span>
                {post.category === "qna" && post.comment_count === 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">답변 대기</span>
                )}
              </div>
              <h1 className="text-h2 text-foreground">{post.title}</h1>
              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                <CommunityAvatar name={post.author_handle} size={24} />
                <span className="font-medium text-foreground">{post.author_handle}</span>
                <span aria-hidden>·</span>
                <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{post.view_count}</span>
              </div>

              {(post.linked_company_slug || post.linked_country || post.linked_job_id) && (
                <div className="flex flex-wrap gap-2">
                  {post.linked_company_slug && (
                    <Link href={`/companies/${post.linked_company_slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption text-foreground hover:border-primary/40">
                      <Briefcase className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {post.linked_company_slug}
                    </Link>
                  )}
                  {post.linked_country && (
                    <Link href={`/visa/${post.linked_country}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption text-foreground hover:border-primary/40">
                      <span aria-hidden>{countryFlag(post.linked_country) || <Stamp className="h-3.5 w-3.5 text-primary" />}</span>
                      {countryLabel(post.linked_country)} 비자
                    </Link>
                  )}
                  {post.linked_job_id && (
                    <Link href={`/jobs/${post.linked_job_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-caption text-foreground hover:border-primary/40">
                      <Globe2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      관련 공고
                    </Link>
                  )}
                </div>
              )}
            </header>

            <div className="whitespace-pre-wrap text-body leading-7 text-foreground">{post.body}</div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/community?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-surface-2 px-2.5 py-0.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {post.source_url && (
              <p className="text-caption text-muted-foreground">
                출처:{" "}
                <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {post.source_url}
                </a>
              </p>
            )}

            <div className="border-t border-border pt-4">
              <PostInteractions
                postId={post.id}
                initialReacted={post.viewer_reacted}
                initialScore={post.score}
                loggedIn={loggedIn}
                mine={post.mine}
              />
            </div>
          </article>

          {/* 댓글 카드 */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <CommentSection postId={post.id} initialComments={post.comments} loggedIn={loggedIn} />
          </div>
        </div>

        <CommunitySidebar facets={facets} />
      </div>
    </div>
  );
}
