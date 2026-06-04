import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoachChat } from "@/components/coach/CoachChat";

const jobs = [{ id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } }];

describe("CoachChat", () => {
  it("disables send until job + resume + input all present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /보내기/ });
    expect(send).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/질문/), "어떻게 고칠까요?");
    expect(send).toBeEnabled();
  });

  it("posts and appends assistant reply", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: "Go 경험을 위로 올리세요." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/질문/), "어떻게?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("Go 경험을 위로 올리세요.")).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    expect(body.job_id).toBe("greenhouse:acme:1");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "어떻게?" });
  });
});
