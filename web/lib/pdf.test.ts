import { describe, expect, it, vi } from "vitest";

// unpdf 자체는 라이브러리 책임 — 여기선 래퍼 로직(병합·trim·길이제한)만 검증.
vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: vi.fn(async () => ({ text: ["Go developer", "5y exp"] })),
}));

import { extractText } from "unpdf";

import { extractResumeText, MAX_RESUME_CHARS } from "./pdf";

describe("extractResumeText", () => {
  it("페이지를 병합하고 trim 해서 반환한다", async () => {
    const out = await extractResumeText(new ArrayBuffer(8));
    expect(out).toBe("Go developer\n5y exp");
  });

  it("MAX_RESUME_CHARS 로 길이를 제한한다", async () => {
    vi.mocked(extractText).mockResolvedValueOnce({
      text: "x".repeat(MAX_RESUME_CHARS + 100),
      totalPages: 1,
    } as never);
    const out = await extractResumeText(new ArrayBuffer(8));
    expect(out.length).toBe(MAX_RESUME_CHARS);
  });
});
