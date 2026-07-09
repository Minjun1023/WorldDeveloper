"use client";

import { useEffect, useRef, useState } from "react";

import { recordEvents } from "@/lib/feedback";
import { readRecommendCache, writeRecommendCache, type Reaction } from "@/lib/recommend-cache";
import type { RecommendResponse } from "@/lib/types";

// 맞춤 추천 데이터/상태를 캐시와 함께 관리하는 훅 — 홈 랜딩 맞춤 추천 섹션에서 사용.
// (/recommend 전용 페이지는 홈과 중복이라 삭제 — 2026-07)
//
// 동작:
//  - 마운트 시 캐시 적중(TTL 이내) → 즉시 표시, 재요청 0(로딩 없음).
//  - 캐시 미스 → 로딩 표시 + /api/me/recommend 패치 후 캐시에 저장.
//  - 저장/숨김 토글은 캐시에도 반영(재방문 시 토글 상태 유지).
//  - run(note) 의 note 결과는 기본 캐시를 오염시키지 않음(일시적 조회).
// impressionCount: fetch 직후 노출 임프레션으로 기록할 상위 개수(기본 topK).
// '더 보기'로 점진 노출하는 화면은 처음 보이는 만큼만 넘겨, 안 보인 카드까지 임프레션으로
// 과집계되는 것을 막는다(나머지는 노출 시점에 별도 기록).
export function useCachedRecommend({
  cacheKey,
  topK,
  impressionCount,
}: {
  cacheKey: string;
  topK: number;
  impressionCount?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const tsRef = useRef(0); // 캐시 TTL 기준 시각(최초 fetch/캐시 적중 시각). 토글로는 갱신 안 함.
  const cacheableRef = useRef(true); // note 적용 결과는 false → 기본 캐시 미기록.

  async function run(noteText?: string) {
    setLoading(true);
    setError(null);
    setNeedsProfile(false);
    cacheableRef.current = !noteText; // 기본(노트 없음) 결과만 캐시 대상.
    try {
      const res = await fetch("/api/me/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteText ?? null, top_k: topK }),
      });
      if (res.status === 409) {
        setNeedsProfile(true);
        setResult(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rec: RecommendResponse = await res.json();
      setResult(rec);
      setHidden(new Set());
      tsRef.current = Date.now();
      recordEvents(
        rec.recommendations.slice(0, impressionCount ?? topK).map((item, i) => ({
          job_id: item.job.id,
          action: "impression" as const,
          rank: i + 1,
          score: item.score.final_score,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = readRecommendCache(cacheKey);
    if (cached) {
      // 캐시 적중: 즉시 표시, 네트워크 요청 없음.
      setResult(cached.result);
      setSaved(new Set(cached.saved));
      setReactions(cached.reactions);
      setHidden(new Set(cached.hidden));
      tsRef.current = cached.ts;
      cacheableRef.current = true;
      setLoading(false);
      return;
    }
    (async () => {
      // 저장/반응 초기 상태를 먼저 적재(카드 mount 시 시드되도록).
      try {
        const r = await fetch("/api/me/interactions");
        if (r.ok) {
          const it = await r.json();
          setSaved(new Set<string>(it.saved ?? []));
          setReactions(it.reactions ?? {});
        }
      } catch {
        /* 베스트 에포트 — 실패해도 추천 자체는 동작 */
      }
      run();
    })();
    // run/cacheKey 외 의존성 없음(마운트 1회).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // 상태 변화 시 캐시 반영(기본 뷰만). result 없거나 note 결과면 미기록.
  useEffect(() => {
    if (!result || !cacheableRef.current) return;
    writeRecommendCache(cacheKey, {
      result,
      saved: [...saved],
      reactions,
      hidden: [...hidden],
      ts: tsRef.current || Date.now(),
    });
  }, [cacheKey, result, saved, reactions, hidden]);

  const onSaveChange = (jobId: string, s: boolean) =>
    setSaved((prev) => {
      const n = new Set(prev);
      if (s) n.add(jobId);
      else n.delete(jobId);
      return n;
    });

  const onDislike = (jobId: string) => setHidden((prev) => new Set(prev).add(jobId));

  const visible = result
    ? result.recommendations.slice(0, topK).filter((it) => !hidden.has(it.job.id))
    : [];

  return { loading, needsProfile, error, result, saved, reactions, visible, run, onSaveChange, onDislike };
}
