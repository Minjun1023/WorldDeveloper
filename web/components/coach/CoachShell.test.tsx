import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/coach",
}));

import { CoachShell } from "@/components/coach/CoachShell";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) })),
  );
});

describe("CoachShell", () => {
  it("logged out: no conversation rail", () => {
    render(<CoachShell loggedIn={false} initialJobId={null} />);
    expect(screen.queryByRole("button", { name: /새 상담/ })).not.toBeInTheDocument();
  });

  it("logged in: shows rail and can collapse/expand it", async () => {
    render(<CoachShell loggedIn={true} initialJobId={null} />);
    expect(screen.getByRole("button", { name: /새 상담/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "대화기록 접기" }));
    expect(screen.queryByRole("button", { name: /새 상담/ })).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: "대화기록 열기" });
    expect(reopen).toBeInTheDocument();
    await userEvent.click(reopen);
    await waitFor(() => expect(screen.getByRole("button", { name: /새 상담/ })).toBeInTheDocument());
  });
});
