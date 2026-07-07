"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CommunityComment } from "@/lib/community";
import { cn } from "@/lib/utils";

export function CommentSection({
  postId,
  initialComments,
  loggedIn,
}: {
  postId: string;
  initialComments: CommunityComment[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<CommunityComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim(), anonymous }),
      });
      if (res.status === 401) {
        router.push(`/signin?callbackUrl=/community/${postId}`);
        return;
      }
      if (res.ok) {
        const c = (await res.json()) as CommunityComment;
        setComments((prev) => [...prev, c]);
        setBody("");
      } else {
        setError("댓글 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류로 댓글을 등록하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-h3">댓글 {comments.length}</h2>

      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="text-body-sm text-muted-foreground">첫 댓글을 남겨보세요.</li>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            className={cn("rounded-lg border p-3.5", c.mine ? "border-primary/30 bg-primary/5" : "border-border bg-surface")}
          >
            <div className="mb-1.5 flex items-center gap-2 text-caption text-muted-foreground">
              <CommunityAvatar name={c.author_handle} size={20} />
              <span className="font-medium text-foreground">{c.author_handle}</span>
              {c.mine && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">내 댓글</span>}
              <span aria-hidden>·</span>
              <span>{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-body-sm text-foreground">{c.body}</p>
          </li>
        ))}
      </ul>

      {loggedIn ? (
        <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface p-3.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="댓글을 입력하세요"
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-3.5 w-3.5" />
              익명
            </label>
            <Button type="submit" disabled={!body.trim() || pending}>
              {pending ? "등록 중…" : "댓글 등록"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="rounded-lg border border-border bg-surface-2 p-4 text-center text-body-sm text-muted-foreground">
          <Link
            href={`/signin?callbackUrl=/community/${postId}`}
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
          >
            로그인
          </Link>
          하면 댓글을 남길 수 있어요.
        </p>
      )}
    </section>
  );
}
