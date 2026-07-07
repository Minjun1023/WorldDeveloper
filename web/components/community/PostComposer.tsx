"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CATEGORIES, SOURCE_TYPES } from "@/lib/community";
import { cn } from "@/lib/utils";

// 글 작성 폼. 카테고리·제목·본문·출처표기·익명 + (선택)회사/공고/국가 연결.
export function PostComposer({
  defaultCategory,
  linkedCompanySlug,
  linkedJobId,
  linkedCountry,
}: {
  defaultCategory?: string;
  linkedCompanySlug?: string;
  linkedJobId?: string;
  linkedCountry?: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory ?? "qna");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceType, setSourceType] = useState("experience");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !pending;

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#+/, "").trim();
    if (!t || t.length > 30) return;
    setTags((prev) => {
      if (prev.length >= 5 || prev.some((x) => x.toLowerCase() === t.toLowerCase())) return prev;
      return [...prev, t];
    });
    setTagInput("");
  }
  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && !e.nativeEvent.isComposing) {
      // IME 조합 중 Enter 는 조합 확정용 — 태그 추가하지 않는다(끝글자 잔류 방지).
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          body: body.trim(),
          anonymous,
          source_type: sourceType,
          source_url: sourceUrl.trim() || null,
          tags,
          linked_company_slug: linkedCompanySlug ?? null,
          linked_job_id: linkedJobId ?? null,
          linked_country: linkedCountry ?? null,
        }),
      });
      if (res.status === 401) {
        router.push("/signin?callbackUrl=/community/new");
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? `오류 (${res.status})`);
      const data = (await res.json()) as { id: string };
      router.push(`/community/${data.id}`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 카테고리 */}
      <div className="space-y-1.5">
        <span className="text-body-sm font-medium">카테고리</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCategory(c.key)}
              className={cn(
                category === c.key
                  ? "border-primary bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                  : "text-muted-foreground",
              )}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder="예: 독일 블루카드 발급 후기 / 면접에서 받은 질문 정리"
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">내용</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder="겪은 일·정보·질문을 적어주세요. 추정보다 실제 경험이 가장 도움이 돼요."
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-body-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {/* 출처 표기 */}
      <div className="space-y-1.5">
        <span className="block text-body-sm font-medium">
          이 글은 <span className="font-normal text-muted-foreground">(정직성: 추정 글은 피해주세요)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {SOURCE_TYPES.map((s) => (
            <Button
              key={s.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSourceType(s.key)}
              className={cn(
                sourceType === s.key
                  ? "border-primary bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                  : "text-muted-foreground",
              )}
            >
              {s.label}
            </Button>
          ))}
        </div>
        {sourceType === "secondhand" && (
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="출처 링크(선택)"
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      {/* 태그 (선택) */}
      <div className="space-y-1.5">
        <span className="block text-body-sm font-medium">
          태그 <span className="font-normal text-muted-foreground">(선택 · 최대 5개 — 비자종류·도시·회사 등)</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
              #{t}
              <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-primary/60 hover:text-primary" aria-label={`${t} 태그 삭제`}>
                ×
              </button>
            </span>
          ))}
          {tags.length < 5 && (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={() => addTag(tagInput)}
              maxLength={30}
              placeholder={tags.length ? "추가…" : "예: BlueCard, Berlin (Enter 로 추가)"}
              className="min-w-[8rem] flex-1 bg-transparent px-1 text-body-sm focus-visible:outline-none"
            />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-body-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4" />
        익명으로 작성 <span className="text-muted-foreground">(닉네임 대신 &lsquo;익명&rsquo;으로 표시돼요)</span>
      </label>

      {error && <p className="text-body-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {pending ? "올리는 중…" : "올리기"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} className="text-muted-foreground">
          취소
        </Button>
      </div>
    </form>
  );
}
