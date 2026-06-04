export type FeedbackAction = "impression" | "click" | "apply_click";

export interface FeedbackEvent {
  job_id: string;
  action: FeedbackAction;
  rank?: number;
  score?: number;
}

/** 이벤트 배치를 기록한다. fire-and-forget — 실패해도 throw 하지 않는다(UX 무영향). */
export async function recordEvents(events: FeedbackEvent[]): Promise<void> {
  if (!events || events.length === 0) return;
  try {
    await fetch("/api/me/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // 무시 — 피드백 실패는 사용자 흐름을 막지 않는다.
  }
}

export async function recordEvent(
  jobId: string,
  action: FeedbackAction,
  ctx?: { rank?: number; score?: number },
): Promise<void> {
  await recordEvents([{ job_id: jobId, action, rank: ctx?.rank, score: ctx?.score }]);
}
