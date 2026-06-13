"use client";

import { useEffect, useState } from "react";

import type { ScoreBreakdown } from "@/lib/types";

type State = "loading" | "ready" | "needsProfile" | "loggedOut" | "error";

export function useMatchScore(jobId: string) {
  const [state, setState] = useState<State>("loading");
  const [score, setScore] = useState<ScoreBreakdown | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/me/match/${encodeURIComponent(jobId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return setState("loggedOut");
        if (res.status === 409) return setState("needsProfile");
        if (!res.ok) return setState("error");
        setScore((await res.json()) as ScoreBreakdown);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [jobId]);

  return { state, score };
}
