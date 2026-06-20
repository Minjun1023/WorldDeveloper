import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoachLanding } from "./CoachLanding";

describe("CoachLanding", () => {
  it("가치 제안·기능을 보여주고, 미배포 통계(만들어낸 수치)는 넣지 않는다", () => {
    render(<CoachLanding loggedIn={false} onStart={() => {}} />);
    expect(screen.getByRole("heading", { name: /합격하는 문장으로/ })).toBeInTheDocument();
    expect(screen.getByText("공고 키워드 매칭")).toBeInTheDocument();
    // 측정값이 없는 통계는 신뢰를 깎으므로 노출하지 않는다(결정 사항).
    expect(screen.queryByText(/통과율/)).not.toBeInTheDocument();
    expect(screen.queryByText(/14,200/)).not.toBeInTheDocument();
    expect(screen.queryByText(/코칭한 이력서/)).not.toBeInTheDocument();
  });

  it("비로그인은 '로그인하고 무료로 시작' 문구 + CTA 는 onStart 호출", async () => {
    const onStart = vi.fn();
    render(<CoachLanding loggedIn={false} onStart={onStart} />);
    expect(screen.getByText("로그인하고 무료로 시작")).toBeInTheDocument();
    // 비로그인이지만 '로그인 없이 1회 무료'는 백엔드 미지원이라 쓰지 않는다.
    expect(screen.queryByText(/로그인 없이/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "내 이력서 코칭받기" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("로그인 상태에서는 베타 무료 문구를 보여준다", () => {
    render(<CoachLanding loggedIn onStart={() => {}} />);
    expect(screen.getByText("베타 기간 무료")).toBeInTheDocument();
  });
});
