import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportDialog } from "@/components/community/ReportDialog";

function stubFetch(body: object, status = 200) {
  return vi.fn(() =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body }),
  );
}

describe("ReportDialog", () => {
  it("submits the selected reason and shows the accepted message", async () => {
    let sentUrl = "";
    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        sentUrl = String(url);
        sentBody = String(init?.body ?? "");
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ already_reported: false, auto_hidden: false }),
        });
      }),
    );
    render(<ReportDialog open onClose={() => {}} targetType="post" targetId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: "신고 제출" }));
    await waitFor(() => expect(screen.getByText(/신고가 접수됐어요/)).toBeInTheDocument());

    expect(sentUrl).toBe("/api/community/reports");
    expect(JSON.parse(sentBody)).toMatchObject({ target_type: "post", target_id: "p1", reason: "스팸·광고" });
  });

  it("shows the already-reported message", async () => {
    vi.stubGlobal("fetch", stubFetch({ already_reported: true, auto_hidden: false }));
    render(<ReportDialog open onClose={() => {}} targetType="post" targetId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: "신고 제출" }));
    await waitFor(() => expect(screen.getByText("이미 신고한 글이에요.")).toBeInTheDocument());
  });

  it("shows a failure message when the request fails", async () => {
    vi.stubGlobal("fetch", stubFetch({}, 502));
    render(<ReportDialog open onClose={() => {}} targetType="post" targetId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: "신고 제출" }));
    await waitFor(() => expect(screen.getByText(/실패/)).toBeInTheDocument());
  });
});
