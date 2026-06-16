"use client";

import { Briefcase, FileText, History, Info, MessageSquareText, RefreshCw, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getRecentJobs } from "@/lib/recent";
import { readRecommendCache } from "@/lib/recommend-cache";

type PickJob = { id: string; title: string; company: { display_name: string } };
type Msg = { role: "user" | "assistant"; content: string };

// 입력창에 채워주는 빠른 프롬프트
const QUICK_PROMPTS = [
  "이 공고에 맞는 키워드는?",
  "경력 요약 다듬어줘",
  "기술 스택 구성 조언",
  "프로젝트 섹션 피드백",
  "면접 예상 질문 뽑아줘",
];

// initialJobs 미제공 시(서버 블로킹 회피) picker 공고를 클라이언트에서 로드한다.
export function CoachChat({ initialJobs }: { initialJobs?: PickJob[] }) {
  const [jobId, setJobId] = useState("");
  const [resume, setResume] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedAt, setHydratedAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PickJob[]>(initialJobs ?? []);
  const [jobsLoading, setJobsLoading] = useState(initialJobs === undefined);
  const threadRef = useRef<HTMLDivElement>(null);

  const canSend = !!jobId && resume.trim().length > 0 && input.trim().length > 0 && !pending;
  const ready = !!jobId && resume.trim().length > 0;
  const selectedJob = jobs.find((j) => j.id === jobId);

  // picker 공고 = 저장한 공고(우선) + 추천. 추천은 클라 캐시 우선(즉시), 없으면 네트워크(비블로킹).
  // initialJobs 가 제공되면(SSR/테스트) 그대로 사용하고 패치하지 않는다.
  useEffect(() => {
    if (initialJobs !== undefined) return;
    let cancelled = false;
    (async () => {
      const collected = new Map<string, PickJob>();
      // 최근 본 공고(로컬, 로그인 불필요) 우선 — 방금 본 공고로 바로 상담 시작.
      for (const r of getRecentJobs()) {
        if (r.id && !collected.has(r.id)) {
          collected.set(r.id, { id: r.id, title: r.title, company: { display_name: r.company } });
        }
      }
      try {
        const r = await fetch("/api/me/saved");
        if (r.ok) {
          const saved = (await r.json()) as PickJob[];
          if (Array.isArray(saved)) for (const j of saved) collected.set(j.id, j);
        }
      } catch {
        /* 무시 */
      }
      const cached = readRecommendCache("full") ?? readRecommendCache("landing");
      if (cached) {
        for (const rec of cached.result.recommendations) {
          const j = rec.job;
          if (!collected.has(j.id)) collected.set(j.id, { id: j.id, title: j.title, company: { display_name: j.company.display_name } });
        }
      } else {
        try {
          const r = await fetch("/api/me/recommend", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ note: null }),
            signal: AbortSignal.timeout(8000),
          });
          if (r.ok) {
            const data = (await r.json()) as { recommendations?: { job: PickJob }[] };
            for (const rec of data.recommendations ?? []) {
              const j = rec.job;
              if (!collected.has(j.id)) collected.set(j.id, j);
            }
          }
        } catch {
          /* 타임아웃/실패 — picker 는 저장 공고만으로 동작 */
        }
      }
      if (!cancelled) {
        setJobs([...collected.values()]);
        setJobsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialJobs]);

  // 새 메시지/타이핑마다 스레드 맨 아래로 스크롤 (jsdom 엔 scrollTo 없음 → scrollTop 폴백)
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // 공고 선택 시 저장된 대화 복원(없으면 빈 상태). 이력서는 저장 안 되므로 재입력 필요.
  useEffect(() => {
    if (!jobId) {
      setMessages([]);
      setHydratedAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`);
        if (cancelled) return;
        if (res.status === 200) {
          const data = await res.json();
          if (Array.isArray(data?.messages) && data.messages.length > 0) {
            setMessages(data.messages as Msg[]);
            setHydratedAt(typeof data.lastActiveAt === "string" ? data.lastActiveAt : null);
            return;
          }
        }
        setMessages([]);
        setHydratedAt(null);
      } catch {
        if (!cancelled) {
          setMessages([]);
          setHydratedAt(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function reset() {
    if (jobId) {
      try {
        await fetch(`/api/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
      } catch {
        /* 무시 */
      }
    }
    setMessages([]);
    setInput("");
    setError(null);
    setHydratedAt(null);
  }

  async function send() {
    if (!canSend) return;
    const next: Msg[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/me/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, resume, messages: next }),
      });
      if (res.status === 503) throw new Error("상담 기능이 아직 설정되지 않았어요.");
      if (!res.ok) throw new Error(`오류 (HTTP ${res.status})`);
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h2">이력서 코치</h1>
          <p className="mt-1.5 max-w-2xl text-body-sm text-muted-foreground">
            최근 본·저장한·추천받은 공고에 맞춰 이력서를 어떻게 고칠지 상담해드려요.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-sm text-foreground transition-colors hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            새 상담
          </button>
        )}
      </div>

      {!jobsLoading && jobs.length === 0 ? (
        <NoJobs />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,360px)_1fr] lg:items-start">
          {/* 좌측: 상담 설정 (데스크톱 sticky) */}
          <aside className="lg:sticky lg:top-24">
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                <Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />
                상담 설정
              </div>

              {/* 공고 선택 */}
              <label className="block space-y-1.5">
                <span className="text-body-sm font-medium">상담할 공고</span>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  disabled={jobsLoading}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <option value="">{jobsLoading ? "공고 불러오는 중…" : "공고 선택…"}</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company.display_name} · {j.title}
                    </option>
                  ))}
                </select>
              </label>

              {selectedJob && (
                <div className="space-y-1.5">
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-caption font-medium text-primary"
                    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
                  >
                    <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {selectedJob.company.display_name} · {selectedJob.title}
                    </span>
                  </span>
                  <p className="text-caption text-muted-foreground">이 공고에 맞춰 조언 중</p>
                </div>
              )}

              {/* 이력서 */}
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-body-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  이력서
                  <span className="font-normal text-muted-foreground">(저장되지 않아요)</span>
                </span>
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  rows={9}
                  placeholder="이력서 전문을 붙여넣으세요"
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                대화는 90일간 저장돼 이어볼 수 있어요. 이력서는 저장되지 않아요. &quot;새 상담&quot;으로 언제든 삭제할 수 있어요.
              </p>
            </div>
          </aside>

          {/* 우측: 대화 */}
          <section className="flex h-[calc(100vh-15rem)] max-h-[760px] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {/* 스레드 */}
            <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {hydratedAt && resume.trim().length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-caption text-muted-foreground">
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    이전 상담을 이어갑니다
                    {hydratedAt ? ` · ${new Date(hydratedAt).toLocaleDateString("ko-KR")}` : ""}.
                    이어가려면 왼쪽에 이력서를 다시 붙여넣어 주세요.
                  </span>
                </div>
              )}
              {messages.length === 0 && !pending && !error && <EmptyThread ready={ready} />}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <span className="inline-block max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-body-sm text-primary-foreground">
                      {m.content}
                    </span>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start gap-2.5">
                    <CoachAvatar />
                    <span className="inline-block max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5 text-body-sm text-foreground">
                      {m.content}
                    </span>
                  </div>
                ),
              )}

              {pending && (
                <div className="flex justify-start gap-2.5">
                  <CoachAvatar />
                  <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 px-3.5 py-2.5 text-body-sm text-destructive"
                  style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 7%, transparent)" }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* 푸터: 빠른 프롬프트 + 입력 */}
            <div className="space-y-3 border-t border-border bg-surface p-4">
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInput(p)}
                    className="rounded-full border border-border px-3 py-1 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
                  className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-body-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="보내기"
                  className="bg-brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-5 w-5" aria-hidden="true" />
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// 코치(AI) 말풍선 앞 그라데이션 아바타
function CoachAvatar() {
  return (
    <span className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function EmptyThread({ ready }: { ready: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="bg-brand-gradient mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
        <MessageSquareText className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-body font-medium text-foreground">
        {ready ? "이제 무엇이든 물어보세요" : "왼쪽에서 공고와 이력서를 먼저 채워주세요"}
      </p>
      <p className="mt-1.5 max-w-sm text-body-sm text-muted-foreground">
        {ready
          ? "이 공고에 맞춰 이력서를 어떻게 고칠지 물어보세요. 아래 빠른 질문을 눌러도 돼요."
          : "공고를 고르고 이력서를 붙여넣으면 그 공고 기준으로 상담을 시작할 수 있어요."}
      </p>
    </div>
  );
}

function NoJobs() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
      <span className="bg-brand-gradient mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
        <Briefcase className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-body font-medium text-foreground">상담할 공고가 없어요</p>
      <p className="mx-auto mt-1.5 max-w-md text-body-sm text-muted-foreground">
        먼저 공고를 저장하거나 맞춤 추천을 받아보세요. 코치는 고른 공고 하나에 맞춰 이력서를 봐드려요.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/recommend"
          className="bg-brand-gradient rounded-xl px-5 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          맞춤 추천 받기
        </Link>
        <Link
          href="/search"
          className="rounded-xl border border-border px-5 py-2.5 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          공고 검색하기
        </Link>
      </div>
    </div>
  );
}
