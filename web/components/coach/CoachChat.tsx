"use client";

import { ArrowUp, Briefcase, Check, FileText, History, Info, Paperclip, RefreshCw, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { getRecentJobs } from "@/lib/recent";
import { readRecommendCache } from "@/lib/recommend-cache";
import { cn } from "@/lib/utils";

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
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedAt, setHydratedAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PickJob[]>(initialJobs ?? []);
  const [jobsLoading, setJobsLoading] = useState(initialJobs === undefined);
  const [modalOpen, setModalOpen] = useState(false); // 공고·이력서 첨부 모달
  const threadRef = useRef<HTMLDivElement>(null);

  const canSend = !!jobId && resume.trim().length > 0 && input.trim().length > 0 && !pending;
  const selectedJob = jobs.find((j) => j.id === jobId);
  const started = messages.length > 0;
  const hasResume = resume.trim().length > 0;
  const attachmentCount = (jobId ? 1 : 0) + (hasResume ? 1 : 0);
  const needsAttach = !jobId || !hasResume;

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
    setModalOpen(false);
  }

  function onResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setResume(typeof reader.result === "string" ? reader.result : "");
      setResumeFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function send() {
    if (!canSend) {
      if (needsAttach) setModalOpen(true); // 필수 첨부가 빠졌으면 모달을 열어 안내
      return;
    }
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

  // 직행 커리어AI 식 입력 카드: 메시지 + 둥근 첨부(좌)·전송(우). 공고·이력서는 모달로 첨부.
  const composer = (
    <div className="w-full">
      <div className="w-full rounded-2xl border border-border bg-surface shadow-sm">
        {/* 메시지 */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="메시지를 입력하세요 — 이 공고에 맞춰 답해드려요 (Enter 전송, Shift+Enter 줄바꿈)"
          className="block max-h-44 min-h-[4rem] w-full resize-none bg-transparent px-4 pt-4 text-body-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {/* 푸터: 첨부(좌) + 전송(우) */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1.5">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-haspopup="dialog"
            aria-label="공고·이력서 첨부"
            style={attachmentCount ? { backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)" } : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors",
              attachmentCount
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            공고·이력서
            {attachmentCount === 2 && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="보내기"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity",
              canSend ? "bg-brand-gradient text-white hover:opacity-90" : "bg-surface-2 text-muted-foreground",
            )}
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 첨부 알림 / 안내 */}
      {attachmentCount > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selectedJob && (
            <AttachedChip icon={Briefcase}>
              공고 · {selectedJob.company.display_name} · {selectedJob.title}
            </AttachedChip>
          )}
          {hasResume && (
            <AttachedChip icon={FileText}>
              {resumeFileName ? `이력서 첨부됨 · ${resumeFileName}` : "이력서 첨부됨"}
            </AttachedChip>
          )}
          {needsAttach && (
            <button type="button" onClick={() => setModalOpen(true)} className="text-caption font-medium text-primary hover:underline">
              {!jobId ? "공고 선택" : "이력서 추가"}
            </button>
          )}
        </div>
      ) : (
        !started && (
          <p className="mt-2 px-1 text-caption text-muted-foreground">
            <button type="button" onClick={() => setModalOpen(true)} className="font-medium text-primary hover:underline">
              공고·이력서
            </button>
            를 첨부하면 그 공고에 맞춰 답해드려요.
          </p>
        )
      )}

      {/* 첨부 모달: 공고 드롭다운 + 이력서(붙여넣기/파일) */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="공고·이력서 첨부">
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
              <Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />
              상담할 공고
            </span>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={jobsLoading}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-body-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <option value="">{jobsLoading ? "공고 불러오는 중…" : "공고를 선택하세요…"}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company.display_name} · {j.title}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                이력서 <span className="font-normal text-muted-foreground">(저장되지 않아요)</span>
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-caption font-medium text-foreground transition-colors hover:bg-accent">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                파일로 첨부
                <input type="file" accept=".txt,.md,.markdown,.text,text/plain" className="sr-only" onChange={onResumeFile} />
              </label>
            </div>
            <textarea
              value={resume}
              onChange={(e) => {
                setResume(e.target.value);
                setResumeFileName(null);
              }}
              rows={8}
              placeholder="이력서 전문을 붙여넣으세요"
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {resumeFileName ? (
              <p className="flex items-center gap-1.5 text-caption text-primary">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {resumeFileName} 불러옴 · 내용을 확인하거나 수정할 수 있어요.
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">
                텍스트(.txt, .md) 파일을 첨부하거나 위에 직접 붙여넣으세요. PDF는 텍스트를 복사해 붙여넣어 주세요.
              </p>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );

  // 빠른 질문 칩
  const pills = (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setInput(p)}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative">
      {/* 옅은 파랑 배경 글로우 (Figma 하단 그라데이션을 절제해 재현) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-12 -z-10 mx-auto h-72 max-w-3xl blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--primary) 11%, transparent), transparent)" }}
      />

      {!jobsLoading && jobs.length === 0 ? (
        <div className="mx-auto max-w-2xl">
          <NoJobs />
        </div>
      ) : started ? (
        // 대화 진행
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            {selectedJob ? (
              <span
                className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium text-primary"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {selectedJob.company.display_name} · {selectedJob.title}
                </span>
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={reset}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-sm text-foreground transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              새 상담
            </button>
          </div>

          {/* 스레드 */}
          <div
            ref={threadRef}
            className="min-h-[260px] flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-sm"
            style={{ maxHeight: "calc(100vh - 24rem)" }}
          >
            {hydratedAt && resume.trim().length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-caption text-muted-foreground">
                <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  이전 상담을 이어갑니다
                  {hydratedAt ? ` · ${new Date(hydratedAt).toLocaleDateString("ko-KR")}` : ""}.
                  이어가려면 아래 &lsquo;공고·이력서&rsquo;에서 이력서를 다시 첨부해 주세요.
                </span>
              </div>
            )}

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
              <div
                className="rounded-lg border border-destructive/30 px-3.5 py-2.5 text-body-sm text-destructive"
                style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 7%, transparent)" }}
              >
                {error}
              </div>
            )}
          </div>

          {composer}
          {pills}
        </div>
      ) : (
        // 진입(빈) 상태 — 중앙 히어로
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-2 sm:pt-6">
          <div className="flex flex-col items-center text-center">
            <p className="text-body text-muted-foreground">이 공고, 내 이력서로 통할까?</p>
            <h1 className="mt-2 text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold leading-tight tracking-tight text-foreground">
              막연한 불안 대신, 바로 물어보세요
            </h1>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1.5 text-caption text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              선택한 공고의 요건에 맞춰 이력서를 봐드려요
            </span>
          </div>

          {composer}
          {pills}

          <p className="flex max-w-md items-start justify-center gap-1.5 text-center text-caption text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            선택한 공고와 붙여넣은 이력서만 보고 답해요. 대화는 90일간 저장되고, 이력서는 저장되지 않아요.
          </p>
        </div>
      )}
    </div>
  );
}

// 첨부 완료 표시 칩 (공고/이력서)
function AttachedChip({ icon: Icon, children }: { icon: typeof Briefcase; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium text-primary"
      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
    >
      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
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
