// 맞춤 추천 결과 클라이언트 캐시 — localStorage 기반. 재방문 시 즉시 표시(재요청 0).
// TTL 안에서만 유효(만료 시 null → 재요청). 저장/반응/숨김 상태도 함께 캐시해 토글 상태를 즉시 복원.
// 프로필 변경 시 clearRecommendCache 로 무효화(편집 후 신선한 추천).

import type { RecommendResponse } from "@/lib/types";

// 추천 카드 반응(좋아요/싫어요) — /recommend 전용 카드 삭제(2026-07) 후 타입만 이곳으로 이동.
export type Reaction = "like" | "dislike" | null;

// 버전 접두사 — 추천 결과 형태/로직이 바뀌면 올려 기존 캐시를 일괄 무효화한다.
// v2: dislike 백필 수정 + 랜딩 삭제버튼 제거로 과거(개수 줄어든) 캐시를 버림.
const PREFIX = "wd:rec:v2:";
// 추천은 ETL(매일 자정)로 갱신되므로 몇 시간 캐시는 충분히 신선. 그 안엔 재요청 없이 즉시 표시.
export const RECOMMEND_TTL_MS = 1000 * 60 * 60 * 6; // 6시간

export type RecommendCache = {
  result: RecommendResponse;
  saved: string[];
  reactions: Record<string, Reaction>;
  hidden: string[];
  ts: number; // 최초 fetch 시각(TTL 기준)
};

export function readRecommendCache(key: string): RecommendCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommendCache;
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > RECOMMEND_TTL_MS) return null; // 만료
    if (!parsed.result || !Array.isArray(parsed.result.recommendations)) return null;
    return {
      result: parsed.result,
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      reactions: parsed.reactions ?? {},
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

export function writeRecommendCache(key: string, data: RecommendCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    /* quota 초과/비가용 — 캐시는 베스트 에포트 */
  }
}

// key 지정 시 해당 캐시만, 없으면 모든 추천 캐시 삭제(프로필 변경 등으로 전체 무효화).
export function clearRecommendCache(key?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (key) {
      window.localStorage.removeItem(PREFIX + key);
      return;
    }
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    /* 무시 */
  }
}
