"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * URL 쿼리스트링을 갱신하는 훅. 검색/필터 상태는 URL 이 single source of truth.
 * page 키가 아닌 값을 바꾸면 page 를 리셋(1페이지로).
 */
export function useUpdateQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (!("page" in updates)) {
        params.delete("page");
      }
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : "/");
    },
    [router, searchParams],
  );
}
