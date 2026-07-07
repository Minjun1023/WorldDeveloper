import { describe, expect, it } from "vitest";

import { VISA_GUIDES, getVisaGuide, guideForLocation } from "@/lib/visa-guide";

describe("visa-guide", () => {
  it("핵심 11개국 가이드를 모두 보유", () => {
    expect(VISA_GUIDES.map((g) => g.slug).sort()).toEqual(
      ["australia", "canada", "france", "germany", "india", "ireland", "japan", "netherlands", "singapore", "uk", "us"],
    );
  });

  it("모든 가이드의 regionCode 가 검색 region 값(ISO 코드)과 일치하는 형식", () => {
    for (const g of VISA_GUIDES) {
      expect(g.regionCode).toMatch(/^[a-z]{2}$/);
    }
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

  it("부분일치 오매칭 방지(Fukuoka→일본, Milwaukee→미국, 'uk' 충돌 없음)", () => {
    // "fukuoka"에 'uk'가 들어있어 영국으로 새지 않아야 함
    expect(guideForLocation("Fukuoka, Japan")?.slug).toBe("japan");
    expect(guideForLocation("Milwaukee, WI, United States")?.slug).toBe("us");
    // 진짜 영국 표기는 여전히 매칭
    expect(guideForLocation("Remote, UK")?.slug).toBe("uk");
    expect(guideForLocation("London, UK")?.slug).toBe("uk");
  });

  it("매칭 안 되거나 빈 입력은 undefined", () => {
    expect(guideForLocation("Mars Base One")).toBeUndefined();
    expect(guideForLocation(null)).toBeUndefined();
    expect(guideForLocation(undefined)).toBeUndefined();
  });
});
