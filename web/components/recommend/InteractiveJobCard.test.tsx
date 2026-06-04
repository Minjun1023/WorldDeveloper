import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import type { RecommendationItem } from "@/lib/types";

const item = {
  job: { id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" }, location: "Berlin", is_remote: false, tags: [] },
  score: { final_score: 0.8, stack: 0.5, visa: 1, location: 0.2, seniority: 0.5, salary: 0.6, semantic: 0.3, penalty_applied: 0, reasons: [], deal_breakers: [] },
} as unknown as RecommendationItem;

describe("InteractiveJobCard", () => {
  it("toggles save optimistically and calls onSaveChange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const onSaveChange = vi.fn();
    render(<InteractiveJobCard item={item} rank={1} initialSaved={false} initialReaction={null} onSaveChange={onSaveChange} onDislike={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSaveChange).toHaveBeenCalledWith("greenhouse:acme:1", true);
  });

  it("calls onDislike when dislike pressed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const onDislike = vi.fn();
    render(<InteractiveJobCard item={item} rank={1} initialSaved={false} initialReaction={null} onSaveChange={() => {}} onDislike={onDislike} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /관심 없음/ }));
    expect(onDislike).toHaveBeenCalledWith("greenhouse:acme:1");
  });
});
