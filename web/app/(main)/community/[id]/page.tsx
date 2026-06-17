import { ArrowLeft, Briefcase, Globe2, Stamp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentSection } from "@/components/community/CommentSection";
import { PostInteractions } from "@/components/community/PostInteractions";
import { categoryLabel, fetchCommunityPost, sourceLabel } from "@/lib/community";
import { getSession, getSessionToken } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function CommunityPostPage({ params }: { params: { id: string } }) {
  const [token, session] = await Promise.all([getSessionToken(), getSession()]);
  const post = await fetchCommunityPost(params.id, token);
  if (!post) notFound();
  const loggedIn = !!session;

  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <Link href="/community" className="inline-flex items-center gap-1 text-body-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        라운지로
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-foreground">{categoryLabel(post.category)}</span>
          <span className="rounded-full border border-border px-2 py-0.5">{sourceLabel(post.source_type)}</span>
          <span className="font-medium text-foreground">{post.author_handle}</span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        <h1 className="text-h2 text-foreground">{post.title}</h1>

        {/* 결합: 회사/국가/공고 연결 칩 */}
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
                <Stamp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {post.linked_country} 비자
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

      <div className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{post.body}</div>

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

      <div className="border-t border-border pt-5">
        <CommentSection postId={post.id} initialComments={post.comments} loggedIn={loggedIn} />
      </div>
    </article>
  );
}
