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

function mockRecommend(total: number) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ total_candidates: total, returned: 0, recommendations: [] }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfilePreview", () => {
  it("fetches the match count once on mount and shows total_candidates", async () => {
    const f = mockRecommend(128);
    vi.stubGlobal("fetch", f);
    render(<ProfilePreview profile={base} />);
    expect(await screen.findByText("128")).toBeInTheDocument();
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
