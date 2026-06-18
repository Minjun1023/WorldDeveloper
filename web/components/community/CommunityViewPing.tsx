"use client";

import { useEffect } from "react";

// 상세 진입 시 조회 1회 등록. 같은 탭 새로고침 중복은 sessionStorage 로 차단(백엔드도 고유 열람자 dedup).
export function CommunityViewPing({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `cv:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage 불가 환경 — 백엔드 dedup 이 최종 방어이므로 그대로 핑.
    }
    fetch(`/api/community/posts/${encodeURIComponent(postId)}/view`, { method: "POST" }).catch(() => {});
  }, [postId]);
  return null;
}
