import { describe, expect, it } from "vitest";

import { employeesLabel, headquartersLabel, industryLabel } from "./company-facts-format";

describe("industryLabel", () => {
  it("알려진 영문 업종을 한국어로", () => {
    expect(industryLabel("software industry")).toBe("소프트웨어");
    expect(industryLabel("financial services")).toBe("금융 서비스");
  });
  it("대소문자 무관", () => {
    expect(industryLabel("Artificial Intelligence")).toBe("인공지능(AI)");
  });
  it("매핑 없으면 영문 그대로(정직)", () => {
    expect(industryLabel("quantum widgets")).toBe("quantum widgets");
  });
});

describe("employeesLabel", () => {
  it("1000명 이상은 천 단위 어림 + '+' + 기준연도", () => {
    expect(employeesLabel(4000, "2022")).toBe("약 4,000명+ (2022년 기준)");
    expect(employeesLabel(8000, "2022")).toBe("약 8,000명+ (2022년 기준)");
  });
  it("연도 없으면 기준연도 생략", () => {
    expect(employeesLabel(4000)).toBe("약 4,000명+");
  });
  it("'+'(이상) 의미에 맞게 내림 — 5597 은 5천명+ (6천명+ 아님)", () => {
    expect(employeesLabel(5597, "2020")).toBe("약 5,000명+ (2020년 기준)");
  });
  it("1000명 미만은 그대로", () => {
    expect(employeesLabel(500, "2024")).toBe("약 500명 (2024년 기준)");
  });
});

describe("headquartersLabel", () => {
  it("도시 + 국가", () => {
    expect(headquartersLabel("San Francisco", "United States")).toBe(
      "San Francisco, United States",
    );
  });
  it("도시에 국가가 이미 있으면 중복 안 붙임", () => {
    expect(headquartersLabel("Singapore", "Singapore")).toBe("Singapore");
  });
  it("hq 없으면 폴백(프로필 위치)", () => {
    expect(headquartersLabel(null, null, "Berlin, Germany")).toBe("Berlin, Germany");
    expect(headquartersLabel(undefined, undefined, undefined)).toBeNull();
  });
});
