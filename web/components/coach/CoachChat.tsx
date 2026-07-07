"use client";

import { ArrowUp, Briefcase, FileText, History, Info, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CoachJobModal, type PickJob } from "./CoachJobModal";
import { CoachResumeModal } from "./CoachResumeModal";

type Msg = { role: "user" | "assistant"; content: string };

const SIGNIN = "/signin?callbackUrl=/coach";

// 질문·공고·이력서가 하나도 없이 보내기를 눌렀을 때만 띄우는 안내.
const EMPTY_GUIDANCE =
  "무엇이 궁금하신가요? 질문을 입력하거나, 위 ‘＋’로 공고·이력서를 첨부해 보세요. 하나만 있어도 답해드려요.";

// 메시지 없이 첨부만 보낼 때 자동으로 채울 기본 질문(첨부 구성에 맞춰).
function defaultQuestion(hasJob: boolean, hasResume: boolean): string {
  if (hasResume && hasJob) return "이 공고 기준으로 제 이력서를 평가하고 보완점을 알려주세요.";
  if (hasResume) return "제 이력서를 검토하고 개선점을 알려주세요.";
  if (hasJob) return "이 공고에 지원하려면 무엇을 준비하면 좋을까요?";
  return "이력서 작성에 대해 조언해 주세요.";
}

// initialJobs 미제공 시(서버 블로킹 회피) picker 공고를 클라이언트에서 로드한다.
export function CoachChat({
  initialJobs,
  loggedIn = true,
  selectSignal,
  onConversationSaved,
  onActiveJobChange,
}: {
  initialJobs?: PickJob[];
  loggedIn?: boolean;
  selectSignal?: { jobId: string | null; n: number };
  onConversationSaved?: () => void;
  onActiveJobChange?: (jobId: string | null) => void;
}) {
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
  const composerWrapRef = useRef<HTMLDivElement>(null);

  // ＋ 팝오버 메뉴 + 두 첨부 모달(공고 / 이력서).
  const [menuOpen, setMenuOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const selectedJob = jobs.find((j) => j.id === jobId);
  const started = messages.length > 0;
  const hasResume = resume.trim().length > 0;
  const attachmentCount = (jobId ? 1 : 0) + (hasResume ? 1 : 0);

  // picker 공고 = 북마크(저장) + 지원상태. 지원준비중(interested) 먼저. 비로그인은 조회하지 않는다.
  useEffect(() => {
    if (initialJobs !== undefined || !loggedIn) return;
    let cancelled = false;
    (async () => {
      const [saved, apps] = await Promise.all([
        fetch("/api/me/saved").then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/me/applications").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const status: Record<string, string> = {};
      const appItems = (apps as { items?: { job_id: string; status: string }[] } | null)?.items;
      if (Array.isArray(appItems)) for (const a of appItems) status[a.job_id] = a.status;
      const list: PickJob[] = Array.isArray(saved) ? saved : [];
      const ordered = [
        ...list.filter((j) => status[j.id] === "interested"),
        ...list.filter((j) => status[j.id] !== "interested"),
      ];
      if (!cancelled) {
        setJobs(ordered);
        setJobsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialJobs, loggedIn]);

  // 레일 선택 신호 → jobId 반영. null 이면 새 상담처럼 초기화.
  useEffect(() => {
    if (!selectSignal) return;
    if (selectSignal.jobId) {
      setJobId(selectSignal.jobId);
    } else {
      setJobId("");
      setMessages([]);
      setResume("");
      setResumeFileName(null);
      setInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectSignal?.n]);

  // 활성 공고 변경을 상위에 통지(레일 하이라이트 동기화).
  useEffect(() => {
    onActiveJobChange?.(jobId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // 레일/URL 로 들어온 jobId 가 후보(saved)에 없으면 단건 조회해 합류(비-북마크 직접 진입 엣지케이스용).
  useEffect(() => {
    const id = selectSignal?.jobId;
    if (!id || jobs.some((j) => j.id === id)) return;
    let cancelled = false;
    fetch(`/api/jobs/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: PickJob | null) => {
        if (!cancelled && j && j.id) setJobs((xs) => (xs.some((x) => x.id === j.id) ? xs : [j, ...xs]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectSignal?.jobId, jobs]);

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
            setHydratedAt(typeof data.last_active_at === "string" ? data.last_active_at : null);
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
        // 서버에서 삭제됐으므로 상위(레일) 목록을 새로고침해 삭제된 대화가 사라지게 한다.
        onConversationSaved?.();
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
    setMenuOpen(false);
  }

  // ＋ 메뉴 바깥 클릭 / Esc 로 닫기.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!composerWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // ＋ 버튼: 비로그인은 로그인으로, 로그인은 첨부 메뉴 토글.
  function openMenu() {
    if (!loggedIn) {
      router.push(SIGNIN);
      return;
    }
    setMenuOpen((v) => !v);
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
      const res = await fetch("/api/me/coach/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, resume, messages: next }),
      });
      if (res.status === 503) throw new Error("상담 기능이 아직 설정되지 않았어요.");
      if (!res.ok || !res.body) throw new Error(`오류 (HTTP ${res.status})`);
      // 응답을 청크 단위로 받아 어시스턴트 말풍선을 실시간으로 채운다(체감 지연 개선).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let firstChunk = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!firstChunk) {
          firstChunk = true;
          setMessages((m) => [...m, { role: "assistant", content: acc }]);
        } else {
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
      }
      if (!firstChunk) throw new Error("답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
      // 백엔드가 스트림 종료 시 대화를 저장하므로, 좌측 레일 목록을 새로고침한다.
      onConversationSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  // ChatGPT식 알약 컴포저: ＋(첨부 메뉴) + 입력 + 전송. 마이크·음성 없음.
  const composer = (
    <div ref={composerWrapRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-[1.75rem] border border-border bg-surface px-2 py-2 pl-3 shadow-sm">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={openMenu}
          aria-label="공고·이력서 첨부"
          aria-haspopup="menu"
          className={cn(
            "shrink-0 [&_svg]:size-5",
            attachmentCount > 0 && "bg-primary/10 text-primary hover:bg-primary/15",
          )}
        >
          <Plus aria-hidden="true" />
        </Button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 한글 등 IME 조합 중 Enter 는 조합 확정용 — 전송하지 않는다(끝글자 잔류 버그 방지).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          aria-label="코치에게 보낼 메시지"
          placeholder={
            jobId
              ? "메시지를 입력하세요 — 이 공고에 맞춰 답해드려요 (Enter 전송, Shift+Enter 줄바꿈)"
              : "메시지를 입력하세요 — 이력서 전반을 코치해드려요. 공고를 붙이면 맞춤 분석 (Enter 전송)"
          }
          className="block max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-body-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={pending}
          aria-label="보내기"
          className="shrink-0 [&_svg]:size-5"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      </div>

      {/* ＋ 팝오버 메뉴 */}
      {menuOpen && (
        <div className="absolute bottom-[3.5rem] left-0 z-30 min-w-[16rem] rounded-2xl border border-border bg-surface p-1.5 shadow-lg">
          <button
            type="button"
            aria-label="공고 첨부"
            onClick={() => {
              setMenuOpen(false);
              setJobModalOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-body-sm font-semibold text-foreground">공고 첨부</span>
              <span className="block text-caption text-muted-foreground">북마크·지원준비중에서 선택</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="이력서 첨부"
            onClick={() => {
              setMenuOpen(false);
              setResumeModalOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-body-sm font-semibold text-foreground">이력서 첨부</span>
              <span className="block text-caption text-muted-foreground">파일 업로드 또는 붙여넣기</span>
            </span>
          </button>
        </div>
      )}

      {/* 첨부됨 칩 */}
      {attachmentCount > 0 && (
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
        </div>
      )}
    </div>
  );

  const noJobs = loggedIn && !jobsLoading && jobs.length === 0;

  return (
    <div className="relative flex h-full flex-col">
      {/* 옅은 파랑 배경 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-12 -z-10 mx-auto h-72 max-w-3xl blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, hsl(var(--primary)) 11%, transparent), transparent)" }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {noJobs ? (
          <div className="mx-auto w-full max-w-2xl px-4 py-6">
            <NoJobs />
          </div>
        ) : started ? (
          // 대화 진행 — 헤더(공고 칩 + 새 상담) + 메시지 스레드. 컴포저는 하단 바.
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              {selectedJob ? (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium text-primary"
                  style={{ backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)" }}
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {selectedJob.company.display_name} · {selectedJob.title}
                  </span>
                </span>
              ) : (
                <span />
              )}
              <Button type="button" variant="outline" size="sm" onClick={reset} className="shrink-0">
                <RefreshCw aria-hidden="true" />
                새 상담
              </Button>
            </div>

            <div ref={threadRef} className="min-h-[260px] flex-1 space-y-4 overflow-y-auto">
              {hydratedAt && resume.trim().length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-caption text-muted-foreground">
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    이전 상담을 이어갑니다
                    {hydratedAt ? ` · ${new Date(hydratedAt).toLocaleDateString("ko-KR")}` : ""}.
                    이어가려면 위 ‘＋’에서 이력서를 다시 첨부해 주세요.
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

              {pending && messages[messages.length - 1]?.role === "user" && (
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
                  style={{ backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 7%, transparent)" }}
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          // 진입(빈) 상태 — 미니멀: 헤드라인 + 중앙 컴포저 + 안내.
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
            <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-foreground">
              이력서, 어떤 걸 도와드릴까요?
            </h1>
            <div className="mt-6 w-full">{composer}</div>
            {loggedIn ? (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                붙여넣은 공고·이력서만 보고 답해요. 이력서는 저장되지 않아요.
              </p>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-3">
                <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-foreground">로그인 시 이용 가능</span> · 이력서는 저장되지 않아요.
                  </span>
                </p>
                <Link
                  href={SIGNIN}
                  className="bg-brand-gradient rounded-xl px-5 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  로그인하고 시작 →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 고정 컴포저 — 대화 진행 중에만(빈 상태는 컴포저가 중앙). */}
      {!noJobs && started && (
        <div className="shrink-0 border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-4 py-3">{composer}</div>
        </div>
      )}

      {/* 첨부 모달 — ＋ 메뉴에서 연다(공고 / 이력서). */}
      <CoachJobModal
        open={jobModalOpen}
        jobs={jobs}
        jobsLoading={jobsLoading}
        selectedId={jobId}
        onSelect={(id) => setJobId(id)}
        onClose={() => setJobModalOpen(false)}
      />
      <CoachResumeModal
        open={resumeModalOpen}
        initialText={resume}
        initialFileName={resumeFileName}
        onCommit={(text, name) => {
          setResume(text);
          setResumeFileName(name);
        }}
        onClose={() => setResumeModalOpen(false)}
      />
    </div>
  );
}

// 첨부 완료 표시 칩 (공고/이력서)
function AttachedChip({ icon: Icon, children }: { icon: typeof Briefcase; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium text-primary"
      style={{ backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)" }}
    >
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
