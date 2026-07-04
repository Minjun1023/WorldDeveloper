import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/auth/AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));

import { SiteNav } from "@/components/SiteNav";

describe("SiteNav", () => {
  it("Figma 내비 항목을 평면 상위 링크로 노출한다", () => {
    render(<SiteNav loggedIn={false} />);
    const links: Array<[string, string]> = [
      ["홈", "/"],
      ["공고 검색", "/search"],
      ["맞춤 추천", "/recommend"],
      ["북마크", "/bookmarks"],
      ["기업", "/companies"],
      ["이력서 코치", "/coach"],
    ];
    for (const [name, href] of links) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    // 커뮤니티: 콘텐츠가 쌓일 때까지 내비에서 숨김(라우트는 유지).
    expect(screen.queryByRole("link", { name: "커뮤니티" })).not.toBeInTheDocument();
  });

  it("비로그인 시 로그인·회원가입 CTA 를 보여준다", () => {
    render(<SiteNav loggedIn={false} />);
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/signin");
    expect(screen.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/signup");
  });
});
