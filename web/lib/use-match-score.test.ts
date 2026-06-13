import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMatchScore } from "./use-match-score";

afterEach(() => vi.restoreAllMocks());

describe("useMatchScore", () => {
  it("401 → loggedOut", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const { result } = renderHook(() => useMatchScore("greenhouse:acme:1"));
    await waitFor(() => expect(result.current.state).toBe("loggedOut"));
  });
  it("409 → needsProfile", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 409 }));
    const { result } = renderHook(() => useMatchScore("greenhouse:acme:1"));
    await waitFor(() => expect(result.current.state).toBe("needsProfile"));
  });
  it("200 → ready with score", async () => {
    const body = JSON.stringify({ final_score: 0.78, stack: 0.84, visa: 1, location: 0.65, seniority: 0.72, salary: 0, semantic: 0.5, penalty_applied: 0, reasons: [], deal_breakers: [] });
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(body, { status: 200 }));
    const { result } = renderHook(() => useMatchScore("greenhouse:acme:1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.score?.final_score).toBeCloseTo(0.78);
  });
});
