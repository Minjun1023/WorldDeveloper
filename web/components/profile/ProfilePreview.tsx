"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DIM_TOTAL, PROFILE_DIMS, dimState, reflectedCount } from "@/lib/profile-dimensions";
import { cn } from "@/lib/utils";
import type { RecommendProfile, RecommendResponse } from "@/lib/types";

// '잘 맞는 공고' 기준 점수. 이 미만은 후보 풀엔 있어도 매칭 카운트엔 안 센다.
// (total_candidates 는 후보 풀 크기라 프로필과 무관하게 일정 → 매칭 수로 쓰면 오해를 부른다.)
const STRONG_MATCH = 0.5;

export function ProfilePreview({ profile }: { profile: RecommendProfile }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 후보 전량을 점수와 함께 받아 임계(STRONG_MATCH) 이상만 센다 → 프로필에 따라 변하는 '잘 맞는 공고 수'.
        body: JSON.stringify({ ...profileRef.current, top_k: 100, max_per_company: 99 }),
        // 백엔드(추천 엔진)가 느려도 '계산 중…'에 무한히 갇히지 않도록 타임아웃.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as RecommendResponse;
      const strong = (data.recommendations ?? []).filter(
        (r) => (r.score?.final_score ?? 0) >= STRONG_MATCH,
      ).length;
      setCount(strong);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // 마운트 시 1회만 호출 — 입력마다 호출하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reflected = reflectedCount(profile);

  return (
    <div className="space-y-3">
      {/* 매칭 수 — 레일 히어로 */}
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 text-center">
        {loading ? (
          <p className="py-1.5 text-body-sm text-muted-foreground">매칭 공고 계산 중…</p>
        ) : error ? (
          <p className="py-1.5 text-body-sm text-muted-foreground">매칭 수를 불러올 수 없어요.</p>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            <span className="block text-4xl font-extrabold tabular-nums leading-none text-primary">
              {count ?? "—"}
            </span>
            <span className="mt-1 inline-block">개 공고가 지금 내 프로필과 매칭</span>
          </p>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          갱신
        </button>
      </div>

      {/* 5축 반영 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">5축 반영</p>
          <span className="text-caption font-semibold text-foreground">{reflected}/{DIM_TOTAL} 입력됨</span>
        </div>
        <ul className="text-body-sm">
          {PROFILE_DIMS.map((d) => {
            const s = dimState(profile, d.key);
            return (
              <li key={d.key} className="flex items-center gap-2.5 border-t border-muted py-2 first:border-t-0">
                <span
                  aria-hidden
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.active ? "" : "bg-border")}
                  style={s.active ? { backgroundColor: d.color } : undefined}
                />
                <span className={cn("font-medium", !s.active && "text-muted-foreground")}>{d.label}</span>
                <span className={cn("ml-auto text-caption font-medium", s.active ? "text-foreground/70" : "text-muted-foreground")}>
                  {s.note}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
