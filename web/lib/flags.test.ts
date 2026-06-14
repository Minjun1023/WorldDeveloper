import { describe, expect, it } from "vitest";

import { flagFromLocation, isoFromLocation } from "@/lib/flags";

describe("isoFromLocation", () => {
  it("명시적 국가명을 우선 매핑한다", () => {
    expect(isoFromLocation("Berlin, Germany")).toBe("de");
    expect(isoFromLocation("London, England, United Kingdom")).toBe("gb");
    expect(isoFromLocation("Bangkok, Thailand")).toBe(""); // 미등록 국가는 정직하게 빈값
    expect(isoFromLocation("Mendoza, Argentina")).toBe("ar");
    expect(isoFromLocation("Bangalore, India")).toBe("in");
  });

  it("국가명이 없으면 미국 주 약자로 미국을 추론한다", () => {
    expect(isoFromLocation("Livingston, NJ / New York, NY / Sunnyvale, CA")).toBe("us");
    expect(isoFromLocation("Salt Lake City, UT")).toBe("us");
    expect(isoFromLocation("US Remote")).toBe("us");
    expect(isoFromLocation("Remote US (Seattle, WA only)")).toBe("us");
  });

  it("국가명이 주 약자보다 우선해 ISO 충돌(CA=캐나다, DE=독일)을 피한다", () => {
    expect(isoFromLocation("Toronto, Canada")).toBe("ca");
    expect(isoFromLocation("Frankfurt, Germany")).toBe("de");
  });

  it("타이완 국가명을 매핑한다", () => {
    expect(isoFromLocation("Taipei, Taiwan")).toBe("tw");
  });

  it("' - '(대시)로 붙은 다단어 국가명도 매핑한다", () => {
    expect(isoFromLocation("United States - Remote")).toBe("us");
    expect(isoFromLocation("Remote - US")).toBe("us");
    expect(isoFromLocation("Flexible - USA")).toBe("us");
    expect(isoFromLocation("Remote - EMEA")).toBe(""); // 지역명은 빈값(정직)
  });

  it("추론 불가 위치는 빈 문자열(틀린 국기 표시 안 함)", () => {
    expect(isoFromLocation("Eschborn")).toBe("");
    expect(isoFromLocation("원격")).toBe("");
    expect(isoFromLocation("")).toBe("");
    expect(isoFromLocation(null)).toBe("");
    expect(isoFromLocation(undefined)).toBe("");
  });
});

describe("flagFromLocation", () => {
  it("ISO 도출 결과를 국기 이모지로 변환한다", () => {
    expect(flagFromLocation("Berlin, Germany")).toBe("🇩🇪");
    expect(flagFromLocation("Livingston, NJ / New York, NY")).toBe("🇺🇸");
    expect(flagFromLocation("Eschborn")).toBe("");
  });
});
