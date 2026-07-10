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
      ["북마크", "/bookmarks"],
      ["기업", "/companies"],
      ["비자 가이드", "/visa"],
      ["이력서 코치", "/coach"],
    ];
    for (const [name, href] of links) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    // 맞춤 추천: 홈 랜딩 캐러셀이 전체 추천을 담당 — 내비에서 내림(라우트는 유지).
    expect(screen.queryByRole("link", { name: "맞춤 추천" })).not.toBeInTheDocument();
  });

  it("비로그인 시 로그인·회원가입 CTA 를 보여준다", () => {
    render(<SiteNav loggedIn={false} />);
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/signin");
    expect(screen.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/signup");
  });
});
