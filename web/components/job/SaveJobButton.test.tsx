import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaveJobButton } from "@/components/job/SaveJobButton";

function mockFetch(savedIds: string[]) {
  return vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u === "/api/me/interactions") {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ saved: savedIds, reactions: {} }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); // PUT/DELETE
  });
}

describe("SaveJobButton", () => {
  it("toggles save via PUT then DELETE", async () => {
    const fetchMock = mockFetch([]);
    vi.stubGlobal("fetch", fetchMock);
    render(<SaveJobButton jobId="a:b:1" loggedIn />);
    const btn = await screen.findByRole("button", { name: /저장/ });
    await userEvent.click(btn);
    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PUT");
      expect(String(put![0])).toBe("/api/me/saved/a%3Ab%3A1");
    });
    await userEvent.click(screen.getByRole("button", { name: /저장됨/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit)?.method === "DELETE")).toBe(true);
    });
  });

  it("shows initial saved state from interactions", async () => {
    vi.stubGlobal("fetch", mockFetch(["a:b:1"]));
    render(<SaveJobButton jobId="a:b:1" loggedIn />);
    expect(await screen.findByRole("button", { name: /저장됨/ })).toBeInTheDocument();
  });
});
