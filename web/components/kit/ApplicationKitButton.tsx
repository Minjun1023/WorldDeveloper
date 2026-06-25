"use client";

import { useState } from "react";

import { ApplicationKit, type Kit } from "@/components/kit/ApplicationKit";

export function ApplicationKitButton({ jobId, loggedIn }: { jobId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState("");
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function gen() {
    if (!loggedIn) {
      window.location.href = `/signin?callbackUrl=/jobs/${encodeURIComponent(jobId)}`;
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/application-kit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 백엔드는 전역 SNAKE_CASE → job_id 로 보내야 한다(jobId 는 조용히 누락되어 400).
        body: JSON.stringify({ job_id: jobId, resume }),
      });
      if (!r.ok) throw new Error("지원 키트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      setKit((await r.json()) as Kit);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (kit) return <ApplicationKit kit={kit} />;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-body font-semibold text-foreground">지원 키트 만들기</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        이력서를 붙여넣으면 적합도·스킬갭·커버레터·면접질문과 비자 해석을 한 번에 만들어드려요.
      </p>

      {!open ? (
        <button
          onClick={() => {
            if (!loggedIn) {
              window.location.href = `/signin?callbackUrl=/jobs/${encodeURIComponent(jobId)}`;
              return;
            }
            setOpen(true);
          }}
          className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          지원 키트 만들기
        </button>
      ) : (
        <>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={6}
            placeholder="이력서 전문을 붙여넣으세요"
            className="mt-3 w-full rounded-lg border border-input bg-background p-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {err && <p className="mt-2 text-caption text-destructive">{err}</p>}
          <button
            onClick={gen}
            disabled={loading || resume.trim().length === 0}
            className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {loading ? "생성 중…" : "지원 키트 생성"}
          </button>
        </>
      )}
    </section>
  );
}
