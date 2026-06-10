import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveSearchButton } from "@/components/search/SaveSearchButton";

describe("SaveSearchButton", () => {
  it("posts current params and shows saved state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "1" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SaveSearchButton params={{ q: "react", region: "germany", visa: "sponsors" }} label="react · 독일 · 스폰서" loggedIn />);
    await userEvent.click(screen.getByRole("button", { name: /이 검색 저장/ }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.q).toBe("react");
    expect(body.label).toBe("react · 독일 · 스폰서");
    expect(await screen.findByText(/저장됨/)).toBeInTheDocument();
  });
});
