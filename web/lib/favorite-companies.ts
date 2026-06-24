"use client";

import { useEffect, useSyncExternalStore } from "react";

// 관심 기업(★) 상태를 화면·라우트 간 공유하는 경량 스토어. saved-jobs.ts 와 동일 패턴.
// 문제: 기업 목록에서 ★ 누르고 상세 갔다 (클라이언트) 돌아오면 캐시된 RSC 의 initialFav 가
// 갱신되지 않아 ★ 가 빈 채로 남았다(새로고침해야 반영). 해결: 모듈 전역 스토어를 단일 소스로
// 두고 /api/me/favorite-companies 를 1회만 로드. 어느 화면에서 토글하든 스토어를 낙관적으로
// 갱신 → 구독 중인 모든 ★ 가 즉시 동기화되고, 모듈 상태는 클라이언트 내비게이션 동안 유지된다.
type State = { slugs: ReadonlySet<string>; loaded: boolean };

let state: State = { slugs: new Set(), loaded: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return state;
}

let loadStarted = false;
function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  fetch("/api/me/favorite-companies")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const slugs = new Set<string>(
        Array.isArray(d) ? d.map((c: { slug?: string }) => c.slug).filter((s): s is string => !!s) : [],
      );
      state = { slugs, loaded: true };
      emit();
    })
    .catch(() => {
      loadStarted = false; // 재시도 허용
    });
}

// 관심 상태를 낙관적으로 반영(서버 동기화는 호출부에서). 다른 화면 ★ 도 함께 갱신된다.
export function setFavoriteLocal(slug: string, fav: boolean) {
  const slugs = new Set(state.slugs);
  if (fav) slugs.add(slug);
  else slugs.delete(slug);
  state = { slugs, loaded: state.loaded };
  emit();
}

// 테스트 격리용 — 모듈 싱글톤 상태 초기화.
export function resetFavoriteStore() {
  state = { slugs: new Set(), loaded: false };
  loadStarted = false;
}

// 관심 기업 토글 훅. 로딩 전에는 서버가 내려준 initialFav 로 표시(SSR·첫 렌더 일치),
// 로드 후에는 스토어가 단일 소스. loggedIn=false 면 로드/토글하지 않는다(호출부가 로그인 링크 렌더).
export function useFavoriteCompany(slug: string, loggedIn: boolean, initialFav = false) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (loggedIn) ensureLoaded();
  }, [loggedIn]);

  const fav = snap.loaded ? snap.slugs.has(slug) : initialFav;

  function toggle() {
    const next = !fav;
    setFavoriteLocal(slug, next); // 낙관적
    fetch(`/api/me/favorite-companies/${encodeURIComponent(slug)}`, { method: next ? "PUT" : "DELETE" })
      .then((r) => {
        if (!r.ok) setFavoriteLocal(slug, !next); // 서버 거절 롤백
      })
      .catch(() => setFavoriteLocal(slug, !next)); // 실패 롤백
  }

  return { fav, toggle };
}
