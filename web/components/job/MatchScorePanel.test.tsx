import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchScorePanel } from "./MatchScorePanel";

// vi.mock at module level so ESM binding is intercepted before component loads.
const { mockUseMatchScore } = vi.hoisted(() => ({
  mockUseMatchScore: vi.fn(),
}));
vi.mock("@/lib/use-match-score", () => ({ useMatchScore: mockUseMatchScore }));

beforeEach(() => {
  mockUseMatchScore.mockReset();
});

describe("MatchScorePanel", () => {
  it("loggedOut → 로그인 CTA", () => {
    mockUseMatchScore.mockReturnValue({ state: "loggedOut", score: null });
    render(<MatchScorePanel jobId="x" />);
    expect(screen.getByText(/로그인하고 내 매칭/)).toBeInTheDocument();
  });

  it("needsProfile → 프로필 작성 CTA", () => {
    mockUseMatchScore.mockReturnValue({ state: "needsProfile", score: null });
    render(<MatchScorePanel jobId="x" />);
    expect(screen.getByText(/프로필 작성/)).toBeInTheDocument();
  });

  it("ready → 점수 + 축 막대", () => {
    mockUseMatchScore.mockReturnValue({
      state: "ready",
      score: {
        final_score: 0.78,
        stack: 0.84,
        visa: 1,
        location: 0.65,
        seniority: 0.72,
        salary: 0,
        semantic: 0.5,
        penalty_applied: 0,
        reasons: [],
        deal_breakers: [],
      },
    });
    render(<MatchScorePanel jobId="x" />);
    expect(screen.getByText("78")).toBeInTheDocument();
    // "스택"은 육각형 레이더 라벨 + 축 값 리스트 양쪽에 나타남
    expect(screen.getAllByText("스택").length).toBeGreaterThan(0);
  });

  it("error → 안내 + 다시 시도 버튼", () => {
    const retry = vi.fn();
    mockUseMatchScore.mockReturnValue({ state: "error", score: null, retry });
    render(<MatchScorePanel jobId="x" />);
    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
