import { describe, expect, it } from "vitest";

import { employmentLabel, fallbackMetaChip, levelText } from "./jobMeta";

describe("employmentLabel", () => {
  it("maps known employment types to Korean (표기 차이 흡수)", () => {
    expect(employmentLabel("FULLTIME")).toBe("정규직");
    expect(employmentLabel("Full-time")).toBe("정규직");
    expect(employmentLabel("CONTRACTOR")).toBe("계약직");
  });
  it("returns placeholder for empty, raw for unknown", () => {
    expect(employmentLabel(null)).toBe("고용형태 미표기");
    expect(employmentLabel("BERUFSERFAHREN")).toBe("BERUFSERFAHREN");
  });
});

describe("levelText", () => {
  it("maps seniority and handles entry/years", () => {
    expect(levelText(null, "Principal")).toBe("12년+");
    expect(levelText(null, "Staff")).toBe("8년+");
    expect(levelText(null, "Lead")).toBe("7년+");
    expect(levelText(null, "Senior")).toBe("5년+");
    expect(levelText(null, "Junior")).toBe("1년+");
    expect(levelText(5, null)).toBe("5년+");
    expect(levelText(3, "Senior")).toBe("5년+"); // 라벨 우선(연수 모순 방지)
    expect(levelText(0, null)).toBe("신입");
    expect(levelText(null, "Entry")).toBe("신입");
    expect(levelText(null, "Intern")).toBe("인턴");
    expect(levelText(null, null)).toBeNull();
  });
});

describe("fallbackMetaChip", () => {
  it("prefers level, falls back to employment, else null", () => {
    expect(fallbackMetaChip({ seniority: "Junior" })).toBe("1년+");
    expect(fallbackMetaChip({ employment_type: "FREELANCE" })).toBe("프리랜서");
    expect(fallbackMetaChip({})).toBeNull();
  });
});
