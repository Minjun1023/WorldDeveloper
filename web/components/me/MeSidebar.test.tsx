import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me/profile" }));

import { MeSidebar } from "@/components/me/MeSidebar";

describe("MeSidebar", () => {
  it("renders 4 items and marks the active route", () => {
    render(<MeSidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /저장한 공고/ })).not.toHaveAttribute("aria-current");
  });
});
