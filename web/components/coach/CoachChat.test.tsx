import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoachChat } from "@/components/coach/CoachChat";

const jobs = [{ id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } }];

// 공고 선택 시 GET /api/me/coach/conversation 발생 → URL로 분기.
function mockFetch(opts: { conversation?: unknown; convStatus?: number; reply?: string }) {
  return vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/me/coach/conversation")) {
      if (init?.method === "DELETE") return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      const status = opts.convStatus ?? (opts.conversation ? 200 : 204);
      return Promise.resolve({ ok: true, status, json: async () => opts.conversation ?? {} });
    }
    // POST /api/me/coach (reply)
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ reply: opts.reply ?? "ok" }) });
  });
}

describe("CoachChat", () => {
  it("disables send until job + resume + input all present", async () => {
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /보내기/ });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /첨부/ })); // 공고·이력서 트레이 펼치기
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/메시지/), "어떻게 고칠까요?");
    expect(send).toBeEnabled();
  });

  it("posts and appends assistant reply", async () => {
    const fetchMock = mockFetch({ convStatus: 204, reply: "Go 경험을 위로 올리세요." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /첨부/ })); // 공고·이력서 트레이 펼치기
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/메시지/), "어떻게?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("Go 경험을 위로 올리세요.")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe("greenhouse:acme:1");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "어떻게?" });
  });

  it("restores a saved conversation when a job is selected", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversation: {
        jobId: "greenhouse:acme:1",
        messages: [{ role: "assistant", content: "이전 조언이에요." }],
        lastActiveAt: "2026-06-01T00:00:00Z",
      },
    }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /첨부/ })); // 공고·이력서 트레이 펼치기
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await waitFor(() => expect(screen.getByText("이전 조언이에요.")).toBeInTheDocument());
  });
});
