import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JobDescription } from "@/components/job/JobDescription";

const ORIGINAL = "<p>English body content here</p>";

function mockTranslate(opts: { status?: number; ko?: string } = {}) {
  const { status = 200, ko = "<p>번역된 한국어 본문</p>" } = opts;
  return vi.fn((url: string) => {
    if (String(url) === "/api/translate") {
      return Promise.resolve({
        ok: status === 200,
        status,
        json: async () => ({ job_id: "a:b:1", lang: "ko", description: ko }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

describe("JobDescription", () => {
  it("기본 한국어: 마운트 시 자동 번역 후 한국어 본문을 보여준다", async () => {
    const fetchMock = mockTranslate();
    vi.stubGlobal("fetch", fetchMock);
    render(<JobDescription jobId="a:b:1" original={ORIGINAL} />);
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]) === "/api/translate")).toBe(true);
    });
    expect(await screen.findByText(/번역된 한국어 본문/)).toBeInTheDocument();
  });

  it("번역 503이면 원문으로 폴백한다", async () => {
    vi.stubGlobal("fetch", mockTranslate({ status: 503 }));
    render(<JobDescription jobId="a:b:1" original={ORIGINAL} />);
    expect(await screen.findByText(/English body content here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원문" })).not.toBeInTheDocument();
    expect(screen.getByText(/번역을 사용할 수 없어/)).toBeInTheDocument();
  });

  it("원문 토글을 누르면 원문을 고정한다", async () => {
    vi.stubGlobal("fetch", mockTranslate());
    render(<JobDescription jobId="a:b:1" original={ORIGINAL} />);
    await screen.findByText(/번역된 한국어 본문/);
    await userEvent.click(screen.getByRole("button", { name: "원문" }));
    expect(await screen.findByText(/English body content here/)).toBeInTheDocument();
  });
});
