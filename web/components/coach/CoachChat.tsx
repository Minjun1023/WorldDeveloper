"use client";

import { useState } from "react";

type PickJob = { id: string; title: string; company: { display_name: string } };
type Msg = { role: "user" | "assistant"; content: string };

export function CoachChat({ initialJobs }: { initialJobs: PickJob[] }) {
  const [jobId, setJobId] = useState("");
  const [resume, setResume] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!jobId && resume.trim().length > 0 && input.trim().length > 0 && !pending;

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

  if (initialJobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-body-sm text-muted-foreground">
        상담할 공고가 없어요. 먼저 공고를 저장하거나 맞춤 추천을 받아보세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-body-sm font-medium">상담할 공고</span>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body-sm">
            <option value="">공고 선택…</option>
            {initialJobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company.display_name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">이력서 (저장되지 않아요)</span>
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={3}
            placeholder="이력서 전문을 붙여넣으세요"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm" />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 min-h-[160px]">
        {messages.length === 0 && <p className="text-body-sm text-muted-foreground">공고와 이력서를 넣고, 이 공고에 맞춰 이력서를 어떻게 고칠지 물어보세요.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span className={"inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-body-sm " + (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {m.content}
            </span>
          </div>
        ))}
        {pending && <p className="text-body-sm text-muted-foreground">작성 중…</p>}
        {error && <p className="text-body-sm text-destructive">{error}</p>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="질문 입력…"
          className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-body-sm" />
        <button type="submit" disabled={!canSend}
          className="rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground disabled:opacity-50">
          보내기
        </button>
      </form>
    </div>
  );
}
