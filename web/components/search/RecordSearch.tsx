"use client";

import { useEffect } from "react";

// 검색 결과 진입 시 검색어 1건 기록(인기 검색어용). term 변경마다 1회, UI 없음, 실패 무시.
// 백엔드가 (검색어·검색자·일) dedup 하므로 같은 검색어 반복(페이지네이션·필터 변경)은 1카운트로 합쳐진다.
export function RecordSearch({ term }: { term: string }) {
  useEffect(() => {
    const t = term.trim();
    if (!t) return;
    fetch("/api/search/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: t }),
    }).catch(() => {});
  }, [term]);
  return null;
}
