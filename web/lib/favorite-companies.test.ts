import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetFavoriteStore, useFavoriteCompany } from "@/lib/favorite-companies";

describe("useFavoriteCompany (공유 스토어)", () => {
  beforeEach(() => {
    resetFavoriteStore();
    // 초기 로드(GET)는 빈 목록, 토글(PUT/DELETE)은 ok.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })));
  });

  it("한 인스턴스에서 토글하면 같은 slug 의 다른 인스턴스도 즉시 동기화된다(목록↔상세 일관)", async () => {
    const a = renderHook(() => useFavoriteCompany("acme", true, false));
    const b = renderHook(() => useFavoriteCompany("acme", true, false));
    await waitFor(() => expect(a.result.current.fav).toBe(false)); // 초기 로드(빈 목록) 완료

    act(() => a.result.current.toggle());

    expect(a.result.current.fav).toBe(true);
    expect(b.result.current.fav).toBe(true); // 다른 화면 ★ 도 함께 갱신 — 돌아와도 풀리지 않음
  });

  it("로드 전에는 서버가 내려준 initialFav 로 표시한다", () => {
    // loggedIn=false → 자체 로드 안 함(snap.loaded=false) → initialFav 사용
    const { result } = renderHook(() => useFavoriteCompany("acme", false, true));
    expect(result.current.fav).toBe(true);
  });
});
