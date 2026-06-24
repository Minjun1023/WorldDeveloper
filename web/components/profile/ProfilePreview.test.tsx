import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfilePreview } from "@/components/profile/ProfilePreview";
import type { RecommendProfile } from "@/lib/types";

const base: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

// strong: final_score>=0.5 인 공고 수, weak: 임계 미만(카운트에서 제외돼야 함).
function mockRecommend(strong: number, weak = 4) {
  const recs = [
    ...Array.from({ length: strong }, () => ({ job: {}, score: { final_score: 0.7 } })),
    ...Array.from({ length: weak }, () => ({ job: {}, score: { final_score: 0.3 } })),
  ];
  return vi.fn().mockResolvedValue({
    ok: true,
    // total_candidates 는 풀 크기(프로필 무관) — 더 이상 카운트로 쓰지 않음.
    json: () => Promise.resolve({ total_candidates: 75, returned: recs.length, recommendations: recs }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfilePreview", () => {
  it("마운트 시 1회 호출, 임계 이상 '잘 맞는 공고 수'만 센다(풀 크기 아님)", async () => {
    const f = mockRecommend(12); // strong 12 + weak 4 → 12 만 카운트
    vi.stubGlobal("fetch", f);
    render(<ProfilePreview profile={base} />);
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refetches only on 갱신 click, not on prop change", async () => {
    const f = mockRecommend(50);
    vi.stubGlobal("fetch", f);
    const { rerender } = render(<ProfilePreview profile={base} />);
    await screen.findByText("50");
    rerender(<ProfilePreview profile={{ ...base, skills: ["go"] }} />);
    expect(f).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "갱신" }));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("marks unfilled dimensions for an empty profile", async () => {
    vi.stubGlobal("fetch", mockRecommend(0));
    render(<ProfilePreview profile={base} />);
    expect(screen.getAllByText(/→ 입력 필요/).length).toBeGreaterThan(0);
  });
});
