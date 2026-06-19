import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me/profile" }));

import { MeSidebar } from "@/components/me/MeSidebar";

describe("MeSidebar", () => {
  it("프로필 링크만 렌더하고 활성 표시한다", () => {
    render(<MeSidebar />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("aria-current", "page");
  });

  it("지원 현황 링크는 노출하지 않는다", () => {
    render(<MeSidebar />);
    expect(screen.queryByRole("link", { name: /지원/ })).toBeNull();
  });
});
