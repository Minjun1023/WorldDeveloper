"use client";

import { useCallback, useEffect, useState } from "react";

import type { ScoreBreakdown } from "@/lib/types";

type State = "loading" | "ready" | "needsProfile" | "loggedOut" | "error";

// 백엔드(추천 엔진/임베딩)가 느리거나 멈춰도 패널이 무한 로딩(빈 회색 박스)에
// 갇히지 않도록 타임아웃을 둔다. 콜드 스타트 시 임베딩이 느릴 수 있어 10s.
const TIMEOUT_MS = 10_000;

export function useMatchScore(jobId: string) {
  const [state, setState] = useState<State>("loading");
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/me/match/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return setState("loggedOut");
        if (res.status === 409) return setState("needsProfile");
        if (!res.ok) return setState("error");
        setScore((await res.json()) as ScoreBreakdown);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [jobId, attempt]);

  // 일시적 실패(백엔드 재기동 등)를 새로고침 없이 다시 시도.
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { state, score, retry };
}
