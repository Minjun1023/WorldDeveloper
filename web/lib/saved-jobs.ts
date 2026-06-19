"use client";

import { useEffect, useSyncExternalStore } from "react";

// 관심(저장) 공고 상태를 화면·라우트 간 공유하는 경량 스토어.
// 문제: 상세에서 저장한 뒤 검색으로 (클라이언트) 돌아오면 캐시된 RSC 의 initialSaved 가
// 갱신되지 않아 하트가 빈 채로 남고, 새로고침해야만 반영됐다.
// 해결: 모듈 전역 스토어를 단일 소스로 두고, /api/me/interactions 를 1회만 로드한다.
// 어느 화면에서 토글하든 스토어를 낙관적으로 갱신 → 구독 중인 모든 하트가 즉시 동기화되고,
// 모듈 상태는 클라이언트 내비게이션 동안 유지되므로 검색으로 돌아와도 정확하다.
type State = { ids: ReadonlySet<string>; loaded: boolean };

let state: State = { ids: new Set(), loaded: false };
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
  fetch("/api/me/interactions")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const ids = new Set<string>(Array.isArray(d?.saved) ? (d.saved as string[]) : []);
      state = { ids, loaded: true };
      emit();
    })
    .catch(() => {
      loadStarted = false; // 재시도 허용
    });
}

// 저장 상태를 낙관적으로 반영(서버 동기화는 호출부에서). 다른 화면 하트도 함께 갱신된다.
export function setSavedLocal(jobId: string, saved: boolean) {
  const ids = new Set(state.ids);
  if (saved) ids.add(jobId);
  else ids.delete(jobId);
  state = { ids, loaded: state.loaded };
  emit();
}

// 테스트 격리용 — 모듈 싱글톤 상태 초기화.
export function resetSavedStore() {
  state = { ids: new Set(), loaded: false };
  loadStarted = false;
}

// 공고 저장 토글 훅. 로딩 전에는 서버가 내려준 initialSaved 로 표시(SSR·첫 렌더 일치),
// 로드 후에는 스토어가 단일 소스. loggedIn=false 면 로드/토글하지 않는다(호출부가 로그인 링크 렌더).
export function useSaveJob(jobId: string, loggedIn: boolean, initialSaved = false) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (loggedIn) ensureLoaded();
  }, [loggedIn]);

  const saved = snap.loaded ? snap.ids.has(jobId) : initialSaved;

  function toggle() {
    const next = !saved;
    setSavedLocal(jobId, next); // 낙관적
    fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" })
      .then((r) => {
        if (!r.ok) setSavedLocal(jobId, !next); // 서버 거절 롤백
      })
      .catch(() => setSavedLocal(jobId, !next)); // 실패 롤백
  }

  return { saved, toggle };
}
