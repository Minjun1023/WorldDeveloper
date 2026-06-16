import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me/profile" }));

import { MeSidebar } from "@/components/me/MeSidebar";

describe("MeSidebar", () => {
  it("renders 2 items and marks the active route", () => {
    render(<MeSidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /지원 현황/ })).not.toHaveAttribute("aria-current");
  });

  it("프로필 → 지원 현황 순서", () => {
    render(<MeSidebar />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/me/profile", "/me/applications"]);
  });
});
