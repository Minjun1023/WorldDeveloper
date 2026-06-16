import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/auth/AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));

import { SiteNav } from "@/components/SiteNav";

describe("SiteNav 채용 드롭다운", () => {
  it("채용 트리거를 누르면 검색·추천·회사가 나타난다", () => {
    render(<SiteNav loggedIn={false} />);

    // 닫힌 상태에서는 하위 항목이 아직 렌더되지 않는다
    expect(screen.queryByRole("menuitem", { name: "검색" })).toBeNull();

    const trigger = screen.getByRole("button", { name: /채용/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "검색" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("menuitem", { name: "추천" })).toHaveAttribute("href", "/recommend");
    expect(screen.getByRole("menuitem", { name: "회사" })).toHaveAttribute("href", "/companies");
  });

  it("커뮤니티·이력서 코치는 최상위 링크로 항상 보인다", () => {
    render(<SiteNav loggedIn={false} />);
    expect(screen.getByRole("link", { name: "커뮤니티" })).toHaveAttribute("href", "/community");
    expect(screen.getByRole("link", { name: "이력서 코치" })).toHaveAttribute("href", "/me/coach");
  });
});
