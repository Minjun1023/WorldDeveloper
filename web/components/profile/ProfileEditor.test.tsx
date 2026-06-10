import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileEditor } from "@/components/profile/ProfileEditor";

function routeFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me/profile" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === "/api/me/profile") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
    }
    if (url === "/api/recommend") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total_candidates: 10, returned: 0, recommendations: [] }),
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfileEditor", () => {
  it("loads the form then saves via PUT /api/me/profile", async () => {
    const f = routeFetch();
    vi.stubGlobal("fetch", f);
    render(<ProfileEditor />);

    await screen.findByLabelText("기술 스택"); // 로드 완료 후 폼 렌더
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    const putCall = f.mock.calls.find(
      (c) => c[0] === "/api/me/profile" && (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    expect(await screen.findByText("저장됐어요.")).toBeInTheDocument();
  });
});
