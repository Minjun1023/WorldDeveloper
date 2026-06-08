"use client";

import { Briefcase, RefreshCw, Send } from "lucide-react";
import { useState } from "react";

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

export function CoachChat({ initialJobs }: { initialJobs: PickJob[] }) {
  const [jobId, setJobId] = useState("");
  const [resume, setResume] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!jobId && resume.trim().length > 0 && input.trim().length > 0 && !pending;
  const selectedJob = initialJobs.find((j) => j.id === jobId);

  function reset() {
    setMessages([]);
    setInput("");
    setError(null);
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
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-display">이력서 코치</h1>
          <p className="mt-2 text-muted-foreground">
            저장하거나 추천받은 공고에 맞춰 이력서를 어떻게 고칠지 상담해드려요.
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

      {initialJobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-body-sm text-muted-foreground">
          상담할 공고가 없어요. 먼저 공고를 저장하거나 맞춤 추천을 받아보세요.
        </div>
      ) : (
        <>
          {/* 설정: 공고 선택 + 이력서 */}
          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <label className="block space-y-1.5">
              <span className="text-body-sm font-medium">상담할 공고</span>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-body-sm"
              >
                <option value="">공고 선택…</option>
                {initialJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.company.display_name} · {j.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedJob && (
              <div className="flex flex-wrap items-center gap-2 text-caption">
                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {selectedJob.company.display_name} · {selectedJob.title}
                  </span>
                </span>
                <span className="text-muted-foreground">이 공고에 맞춰 조언 중</span>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-body-sm font-medium">이력서 (저장되지 않아요)</span>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                rows={3}
                placeholder="이력서 전문을 붙여넣으세요"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm"
              />
            </label>
          </div>

          {/* 채팅 스레드 */}
          <div className="max-h-[420px] min-h-[200px] space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-4">
            {messages.length === 0 && (
              <p className="text-body-sm text-muted-foreground">
                공고와 이력서를 입력하고, 이 공고에 맞춰 이력서를 어떻게 고칠지 물어보세요.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <span
                  className={
                    "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-body-sm " +
                    (m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-surface-2 text-foreground")
                  }
                >
                  {m.content}
                </span>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              </div>
            )}
            {error && <p className="text-body-sm text-destructive">{error}</p>}
          </div>

          {/* 빠른 프롬프트 */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInput(p)}
                className="rounded-full border border-border px-3 py-1 text-body-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>

          {/* 입력 */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>

          <p className="text-caption text-muted-foreground">
            이력서 내용은 서버에 저장되지 않아요. 새로고침하면 대화가 사라집니다.
          </p>
        </>
      )}
    </div>
  );
}
