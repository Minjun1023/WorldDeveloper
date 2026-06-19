import { describe, expect, it, vi } from "vitest";

vi.mock("./company-profiles", () => ({
  companyProfile: (slug: string) =>
    slug === "stripe" ? { description: "결제 인프라 기업입니다." } : undefined,
}));
vi.mock("./company-facts", () => ({
  COMPANY_FACTS: {
    datadog: { wikidataId: "Q1", industry: "it performance management" },
    weirdco: { wikidataId: "Q2", industry: "quantum widgets" }, // 미매핑 업종
  },
}));

import { companyBlurb } from "./company-blurb";

describe("companyBlurb", () => {
  it("수기 설명이 있으면 그것을 최우선", () => {
    expect(companyBlurb("stripe")).toBe("결제 인프라 기업입니다.");
  });
  it("설명 없고 facts 업종이 매핑되면 한국어 업종", () => {
    expect(companyBlurb("datadog")).toBe("IT 모니터링");
  });
  it("업종이 미매핑이면 그 단계 건너뜀 → 인자 없으면 null", () => {
    expect(companyBlurb("weirdco")).toBeNull();
  });
  it("설명·매핑업종 없고 태그/위치 주면 C 폴백(최대 태그 2개)", () => {
    expect(companyBlurb("unknown", { tags: ["saas", "support", "x"], location: "Dublin" })).toBe(
      "saas · support · Dublin",
    );
  });
  it("아무것도 없으면 null", () => {
    expect(companyBlurb("unknown")).toBeNull();
  });
});
