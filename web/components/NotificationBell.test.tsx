import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/NotificationBell";

function mockSearches(searches: Array<{ newCount: number }>) {
  return vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: async () => searches }),
  );
}

describe("NotificationBell", () => {
  it("저장 검색들의 newCount 합계를 배지로 표시하고 /me/searches 로 링크", async () => {
    vi.stubGlobal("fetch", mockSearches([{ newCount: 3 }, { newCount: 2 }]));
    render(<NotificationBell />);
    const link = await screen.findByRole("link", { name: /새 공고 5건/ });
    expect(link).toHaveAttribute("href", "/me/searches");
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("합계 9 초과는 9+ 로 표시", async () => {
    vi.stubGlobal("fetch", mockSearches([{ newCount: 12 }]));
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("9+")).toBeInTheDocument());
  });

  it("새 공고 0이면 배지 없이 벨만(여전히 링크)", async () => {
    vi.stubGlobal("fetch", mockSearches([{ newCount: 0 }]));
    render(<NotificationBell />);
    const link = screen.getByRole("link", { name: /저장 검색 알림/ });
    expect(link).toHaveAttribute("href", "/me/searches");
    await waitFor(() => {
      expect(screen.queryByText(/^\d/)).not.toBeInTheDocument();
    });
  });

  it("조회 실패해도 벨 링크는 동작(배지 없음)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 502, json: async () => ({}) })));
    render(<NotificationBell />);
    expect(screen.getByRole("link", { name: /저장 검색 알림/ })).toBeInTheDocument();
  });
});
