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
    expect(screen.getByText("스택")).toBeInTheDocument();
  });

  it("error → 렌더 없음", () => {
    mockUseMatchScore.mockReturnValue({ state: "error", score: null });
    const { container } = render(<MatchScorePanel jobId="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
