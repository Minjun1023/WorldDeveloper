import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me/profile" }));

import { MeSidebar } from "@/components/me/MeSidebar";

describe("MeSidebar", () => {
  it("renders 3 items and marks the active route", () => {
    render(<MeSidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /저장한 공고/ })).not.toHaveAttribute("aria-current");
  });

  it("순서가 헤더 계정 드롭다운(AccountMenu)과 동일하다", () => {
    render(<MeSidebar />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/me/profile", "/me/applications", "/me/saved"]);
  });
});
