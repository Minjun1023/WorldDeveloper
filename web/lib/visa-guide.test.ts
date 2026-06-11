import { describe, expect, it } from "vitest";

import { VISA_GUIDES, getVisaGuide, guideForLocation } from "@/lib/visa-guide";

describe("visa-guide", () => {
  it("핵심 6개국 가이드를 모두 보유", () => {
    expect(VISA_GUIDES.map((g) => g.slug).sort()).toEqual(
      ["germany", "ireland", "japan", "netherlands", "uk", "us"],
    );
  });

  it("모든 가이드는 최소 1개 공식 출처와 면책 대상 필드를 가짐", () => {
    for (const g of VISA_GUIDES) {
      expect(g.official.length).toBeGreaterThan(0);
      expect(g.official.every((l) => l.url.startsWith("https://"))).toBe(true);
      expect(g.points.length).toBeGreaterThan(0);
    }
  });

  it("getVisaGuide 는 slug 로 조회, 없으면 undefined", () => {
    expect(getVisaGuide("uk")?.country).toBe("영국");
    expect(getVisaGuide("nowhere")).toBeUndefined();
  });

  it("guideForLocation 은 location 키워드로 국가 추정", () => {
    expect(guideForLocation("London, United Kingdom")?.slug).toBe("uk");
    expect(guideForLocation("Amsterdam")?.slug).toBe("netherlands");
    expect(guideForLocation("Berlin, Germany")?.slug).toBe("germany");
    expect(guideForLocation("Tokyo, Japan")?.slug).toBe("japan");
    expect(guideForLocation("Dublin")?.slug).toBe("ireland");
    expect(guideForLocation("San Francisco, CA")?.slug).toBe("us");
  });

  it("매칭 안 되거나 빈 입력은 undefined", () => {
    expect(guideForLocation("Mars Base One")).toBeUndefined();
    expect(guideForLocation(null)).toBeUndefined();
    expect(guideForLocation(undefined)).toBeUndefined();
  });
});
