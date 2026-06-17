import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CoachShell } from "@/components/coach/CoachShell";

describe("CoachShell", () => {
  it("gates the tool behind login when logged out", () => {
    render(<CoachShell loggedIn={false} />);
    // 사이드바 메뉴
    expect(screen.getByRole("button", { name: "도구" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "소개" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "크레딧" })).toBeInTheDocument();
    // 로그아웃 상태: 도구는 잠김 + 로그인 유도
    expect(screen.getByText("로그인하면 이력서 코치를 이용할 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 시작하기" })).toBeInTheDocument();
    // 채팅 입력(combobox)은 노출되지 않음
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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
