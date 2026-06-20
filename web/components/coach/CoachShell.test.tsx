import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/coach",
}));

import { CoachShell } from "@/components/coach/CoachShell";

describe("CoachShell", () => {
  it("renders the sidebar menu and the coach hero when logged out", () => {
    render(<CoachShell loggedIn={false} />);
    // 사이드바 메뉴
    expect(screen.getByRole("button", { name: "도구" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "소개" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "크레딧" })).toBeInTheDocument();
    // 비로그인도 히어로를 보여준다(실제 사용은 전송 시 로그인 유도).
    // 공고 미첨부(로그아웃 = 공고 없음) 상태의 히어로 카피.
    expect(screen.getByRole("heading", { name: "이력서, 더 잘 보이게 코치할게요" })).toBeInTheDocument();
  });

  it("switches to about and credits views", async () => {
    render(<CoachShell loggedIn={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "소개" }));
    expect(screen.getByRole("heading", { name: "이력서 코치 소개" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "크레딧" }));
    expect(screen.getByText("베타 기간 무료")).toBeInTheDocument();
  });
});
