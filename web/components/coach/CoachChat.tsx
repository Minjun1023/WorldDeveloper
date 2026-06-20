"use client";

import { ArrowUp, Briefcase, Check, FileText, History, Info, Paperclip, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { getRecentJobs } from "@/lib/recent";
import { readRecommendCache } from "@/lib/recommend-cache";
import { cn } from "@/lib/utils";

type PickJob = { id: string; title: string; company: { display_name: string } };
type Msg = { role: "user" | "assistant"; content: string };

// 진입 히어로의 빠른 프롬프트 (Figma). jobSpecific=true 는 공고가 있어야 의미 있는 질문 —
// 공고 미첨부 시 누르면 입력 대신 첨부 모달을 열어, 공고 없이 공고 맞춤 답을 요구하는 경로를 막는다.
const QUICK_PROMPTS: { text: string; jobSpecific: boolean }[] = [
  { text: "이 공고에 맞는 키워드는?", jobSpecific: true },
  { text: "내 이력서에서 부족한 점은?", jobSpecific: false },
  { text: "면접 예상 질문 뽑아줘", jobSpecific: true },
  { text: "자기소개 문단 다듬어줘", jobSpecific: false },
];

const SIGNIN = "/signin?callbackUrl=/coach";

// 질문·공고·이력서가 하나도 없이 보내기를 눌렀을 때만 띄우는 안내.
const EMPTY_GUIDANCE =
  "무엇이 궁금하신가요? 질문을 입력하거나, 아래 ‘공고·이력서’로 공고·이력서를 첨부해 보세요. 하나만 있어도 답해드려요.";

// 메시지 없이 첨부만 보낼 때 자동으로 채울 기본 질문(첨부 구성에 맞춰).
function defaultQuestion(hasJob: boolean, hasResume: boolean): string {
  if (hasResume && hasJob) return "이 공고 기준으로 제 이력서를 평가하고 보완점을 알려주세요.";
  if (hasResume) return "제 이력서를 검토하고 개선점을 알려주세요.";
  if (hasJob) return "이 공고에 지원하려면 무엇을 준비하면 좋을까요?";
  return "이력서 작성에 대해 조언해 주세요.";
}

// initialJobs 미제공 시(서버 블로킹 회피) picker 공고를 클라이언트에서 로드한다.
export function CoachChat({ initialJobs, loggedIn = true }: { initialJobs?: PickJob[]; loggedIn?: boolean }) {
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedAt, setHydratedAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PickJob[]>(initialJobs ?? []);
  const [jobsLoading, setJobsLoading] = useState(initialJobs === undefined && loggedIn);
  const threadRef = useRef<HTMLDivElement>(null);

  // 공고·이력서 첨부 모달 — 초안(draft)을 편집하고 '첨부 완료' 시 커밋.
  const [modalOpen, setModalOpen] = useState(false);
  const [attachTab, setAttachTab] = useState<"paste" | "file">("paste");
  const [draftJobId, setDraftJobId] = useState("");
  const [draftResume, setDraftResume] = useState("");
  const [draftFileName, setDraftFileName] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const modalTitleId = useId();

  const selectedJob = jobs.find((j) => j.id === jobId);
  const started = messages.length > 0;
  const hasResume = resume.trim().length > 0;
  const hasMessage = input.trim().length > 0;
  const attachmentCount = (jobId ? 1 : 0) + (hasResume ? 1 : 0);
  const needsAttach = !jobId || !hasResume;
  const canCommit = !!draftJobId && draftResume.trim().length > 0;

  // picker 공고 = 최근 본 공고 + 저장한 공고 + 추천. 비로그인은 조회하지 않는다(로그인 후 이용).
  useEffect(() => {
    if (initialJobs !== undefined || !loggedIn) return;
    let cancelled = false;
    (async () => {
      const collected = new Map<string, PickJob>();
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
  }, [initialJobs, loggedIn]);

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

  // 첨부 모달 열림/닫힘 → 네이티브 dialog 제어
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    if (modalOpen && !el.open) el.showModal();
    else if (!modalOpen && el.open) el.close();
  }, [modalOpen]);

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
    setJobId("");
    setResume("");
    setResumeFileName(null);
    setModalOpen(false);
  }

  function openAttach() {
    if (!loggedIn) {
      router.push(SIGNIN);
      return;
    }
    setDraftJobId(jobId);
    setDraftResume(resume);
    setDraftFileName(resumeFileName);
    setAttachTab(resumeFileName ? "file" : "paste");
    setModalOpen(true);
  }

  function commitAttach() {
    setJobId(draftJobId);
    setResume(draftResume);
    setResumeFileName(draftFileName);
    setModalOpen(false);
  }

  function readResumeFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraftResume(typeof reader.result === "string" ? reader.result : "");
      setDraftFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function send() {
    if (!loggedIn) {
      router.push(SIGNIN);
      return;
    }
    if (pending) return;
    const typed = input.trim();
    // 질문·공고·이력서 중 하나라도 있으면 실제 AI 호출. 셋 다 없을 때만 안내(호출 없음).
    if (!typed && !jobId && !hasResume) {
      setMessages((m) => [...m, { role: "assistant" as const, content: EMPTY_GUIDANCE }]);
      return;
    }
    // 메시지 없이 첨부만 보낼 땐 첨부 구성에 맞춘 기본 질문을 자동으로 채운다.
    const msg = typed || defaultQuestion(!!jobId, hasResume);
    const next: Msg[] = [...messages, { role: "user", content: msg }];
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
          placeholder={
            jobId
              ? "메시지를 입력하세요 — 이 공고에 맞춰 답해드려요 (Enter 전송, Shift+Enter 줄바꿈)"
              : "메시지를 입력하세요 — 이력서 전반을 코치해드려요. 공고를 붙이면 맞춤 분석 (Enter 전송, Shift+Enter 줄바꿈)"
          }
          className="block max-h-44 min-h-[4rem] w-full resize-none bg-transparent px-4 pt-4 text-body-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1.5">
          <button
            type="button"
            onClick={openAttach}
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
            disabled={pending}
            aria-label="보내기"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity",
              pending ? "bg-surface-2 text-muted-foreground" : "bg-brand-gradient text-white hover:opacity-90",
            )}
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

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
            <button type="button" onClick={openAttach} className="text-caption font-medium text-primary hover:underline">
              {!jobId ? "공고 선택" : "이력서 추가"}
            </button>
          )}
        </div>
      ) : (
        !started && (
          <p className="mt-2 px-1 text-caption text-muted-foreground">
            <button type="button" onClick={openAttach} className="font-medium text-primary hover:underline">
              공고·이력서
            </button>
            를 첨부하면 더 정확하게 답해드려요. 공고는 선택이에요.
          </p>
        )
      )}
    </div>
  );

  // 빠른 질문 칩. 공고 전용 질문인데 공고가 없으면 입력 대신 첨부 모달을 연다.
  const pills = (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_PROMPTS.map((p) => (
        <button
          key={p.text}
          type="button"
          onClick={() => (p.jobSpecific && !jobId ? openAttach() : setInput(p.text))}
          className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {p.text}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative">
      {/* 옅은 파랑 배경 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-12 -z-10 mx-auto h-72 max-w-3xl blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--primary) 11%, transparent), transparent)" }}
      />

      {loggedIn && !jobsLoading && jobs.length === 0 ? (
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
        // 진입(빈) 상태 — 중앙 히어로 (Figma)
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-2 sm:pt-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-[clamp(1.5rem,3.5vw,2.1rem)] font-bold leading-tight tracking-tight text-foreground">
              {jobId ? "이 공고, 내 이력서로 통할까?" : "이력서, 더 잘 보이게 코치할게요"}
            </h1>
            <p className="mt-2 text-body text-muted-foreground">
              {jobId
                ? "선택한 공고의 요건에 맞춰 이력서를 봐드려요."
                : "공고를 붙이면 그 공고에 맞춰, 없으면 이력서 전반을 코치해드려요."}
            </p>
          </div>

          {pills}
          {composer}

          <p className="flex max-w-md items-start justify-center gap-1.5 text-center text-caption text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            붙여넣은 공고·이력서만 보고 답해요. 공고를 첨부한 대화는 90일간 저장되고, 이력서는 저장되지 않아요.
          </p>
        </div>
      )}

      {/* 공고·이력서 첨부 모달 — 공고 드롭다운 + 이력서(붙여넣기 / 파일로 첨부) 탭 */}
      <dialog
        ref={modalRef}
        aria-labelledby={modalTitleId}
        onClose={() => setModalOpen(false)}
        onClick={(e) => {
          if (e.target === modalRef.current) setModalOpen(false);
        }}
        className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id={modalTitleId} className="text-h3 font-semibold">공고·이력서 첨부</h2>
          <button type="button" onClick={() => setModalOpen(false)} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <label className="block space-y-1.5">
            <span className="text-body-sm font-semibold text-foreground">상담할 공고</span>
            <select
              value={draftJobId}
              onChange={(e) => setDraftJobId(e.target.value)}
              disabled={jobsLoading}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-body-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <option value="">{jobsLoading ? "공고 불러오는 중…" : "공고를 선택하세요…"}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company.display_name} · {j.title}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-semibold text-foreground">이력서</span>
              <span className="text-caption text-muted-foreground">(저장되지 않아요)</span>
            </div>

            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {([
                { key: "paste", label: "붙여넣기" },
                { key: "file", label: "파일로 첨부" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAttachTab(t.key)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                    attachTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {attachTab === "paste" ? (
              <textarea
                value={draftResume}
                onChange={(e) => {
                  setDraftResume(e.target.value);
                  setDraftFileName(null);
                }}
                rows={8}
                placeholder="이력서 전문을 붙여넣으세요"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  readResumeFile(e.dataTransfer.files?.[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center transition-colors hover:border-primary/40"
              >
                <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <span className="text-body-sm font-semibold text-foreground">파일을 드래그하거나 클릭해서 선택</span>
                <span className="text-caption text-muted-foreground">.txt .md 지원</span>
                <span className="mt-1 inline-flex rounded-lg border border-border px-4 py-2 text-caption font-medium text-foreground">
                  파일 선택
                </span>
                {draftFileName && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-caption text-primary">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {draftFileName}
                  </span>
                )}
                <span className="mt-1 text-caption text-muted-foreground">PDF는 텍스트를 복사해 붙여넣어 주세요.</span>
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.text,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    readResumeFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-5">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-lg border border-border px-5 py-2.5 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            취소
          </button>
          <button
            type="button"
            onClick={commitAttach}
            disabled={!canCommit}
            className="rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            첨부 완료
          </button>
        </div>
      </dialog>
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
