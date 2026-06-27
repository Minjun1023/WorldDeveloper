import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it("내부 상대 경로는 그대로 허용", () => {
    expect(safeInternalPath("/recommend")).toBe("/recommend");
    expect(safeInternalPath("/jobs/abc?x=1")).toBe("/jobs/abc?x=1");
  });

  it("외부 절대 URL 은 fallback", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("http://evil.com/x")).toBe("/");
  });

  it("프로토콜 상대/백슬래시 우회는 fallback", () => {
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
  });

  it("빈 값/제어문자는 fallback", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("/x\nstuff")).toBe("/");
  });

  it("커스텀 fallback 지원", () => {
    expect(safeInternalPath("https://evil.com", "/signin")).toBe("/signin");
  });
});
