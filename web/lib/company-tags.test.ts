import { describe, expect, it } from "vitest";

import { canonicalTag, isKnownTag, tagDesc, tagLabel } from "@/lib/company-tags";

describe("company-tags", () => {
  it("normalizes alias spellings to a canonical key", () => {
    // 데이터에 두 표기가 공존해 드롭다운에 "Healthtech"가 두 번 뜨던 버그의 회귀 방지.
    expect(canonicalTag("health-tech")).toBe("healthtech");
    expect(canonicalTag("communications")).toBe("communication");
    expect(canonicalTag("infrastructure")).toBe("infra");
    expect(canonicalTag("fintech")).toBe("fintech"); // 대표 키는 그대로
    expect(canonicalTag("python")).toBe("python"); // 미등록 태그도 그대로
  });

  it("resolves label/desc/known through the alias", () => {
    expect(tagLabel("health-tech")).toBe("Healthtech");
    expect(tagDesc("infrastructure")).toBe("클라우드·서버 인프라");
    expect(isKnownTag("communications")).toBe(true);
  });

  it("keeps unregistered derived stack tags out of the discipline filter", () => {
    expect(isKnownTag("python")).toBe(false);
    expect(tagLabel("python")).toBe("python"); // 칩에는 원문 그대로
    expect(tagDesc("python")).toBeUndefined();
  });
});
