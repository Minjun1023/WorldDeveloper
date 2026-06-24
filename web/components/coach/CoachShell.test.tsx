import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/coach",
}));

import { CoachShell } from "@/components/coach/CoachShell";

describe("CoachShell", () => {
  it("renders the coach hero when logged out (no rail)", () => {
    render(<CoachShell loggedIn={false} initialJobId={null} />);
    // 비로그인은 대화 이력 레일을 숨기지만, 랜딩 히어로는 보여준다.
    expect(screen.queryByRole("button", { name: /새 상담/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /합격하는 문장으로/ })).toBeInTheDocument();
  });

  it("renders the conversation rail when logged in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) })),
    );
    render(<CoachShell loggedIn={true} initialJobId={null} />);
    // 로그인 시 좌측 대화 이력 레일(새 상담 버튼 + 이전 상담)을 노출한다.
    expect(screen.getByRole("button", { name: /새 상담/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("이전 상담")).toBeInTheDocument());
  });
});
