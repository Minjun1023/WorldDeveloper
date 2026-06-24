import { describe, expect, it } from "vitest";

import { formatSalary, formatSalaryKrw } from "@/lib/salary";

describe("formatSalary", () => {
  it("원본 통화(파운드/유로) 우선 표시, 연봉 k반올림", () => {
    expect(formatSalary({ currency: "GBP", min: 65600, max: 98400, period: "YEAR" })).toBe("£66k–£98k");
    expect(formatSalary({ currency: "EUR", min: 135000, max: 160000 })).toBe("€135k–€160k");
    expect(formatSalary({ currency: "USD", min: 130000, max: 160000 })).toBe("$130k–$160k");
  });

  it("코드만 있는 통화는 코드 접두", () => {
    expect(formatSalary({ currency: "CAD", min: 176000, max: 200000 })).toBe("C$176k–C$200k");
  });

  it("시급/월급 접미사", () => {
    expect(formatSalary({ currency: "USD", min: 31, max: 45, period: "HOUR" })).toBe("$31–$45/시간");
    expect(formatSalary({ currency: "EUR", min: 6000, max: 8000, period: "MONTH" })).toBe("€6k–€8k/월");
  });

  it("min 만 있으면 단일 표시", () => {
    expect(formatSalary({ currency: "GBP", min: 90000 })).toBe("£90k");
  });

  it("원본 없으면 USD 환산 폴백($Xk–$Yk, 기존과 동일)", () => {
    expect(formatSalary({ min_usd: 120000, max_usd: 160000 })).toBe("$120k–$160k");
    expect(formatSalary({ min_usd: 140000 })).toBe("$140k");
  });

  it("통화는 있으나 금액 없으면 USD 폴백 또는 null", () => {
    expect(formatSalary({ currency: "GBP", min_usd: 100000 })).toBe("$100k");
    expect(formatSalary({ currency: "GBP" })).toBeNull();
  });

  it("빈 입력은 null", () => {
    expect(formatSalary(null)).toBeNull();
    expect(formatSalary(undefined)).toBeNull();
    expect(formatSalary({})).toBeNull();
  });
});

describe("formatSalaryKrw", () => {
  it("USD 연봉을 원화 억 단위로 환산(약 N억 원)", () => {
    expect(formatSalaryKrw({ currency: "USD", min: 130000, max: 160000 })).toBe("약 1.8억~2.2억 원");
    expect(formatSalaryKrw({ min_usd: 120000, max_usd: 160000 })).toBe("약 1.7억~2.2억 원");
  });

  it("min 만 있으면 단일", () => {
    expect(formatSalaryKrw({ min_usd: 140000 })).toBe("약 1.9억 원");
  });

  it("시급/월급은 환산하지 않음(연봉만)", () => {
    expect(formatSalaryKrw({ currency: "USD", min: 31, max: 45, period: "HOUR" })).toBeNull();
  });

  it("USD 환산값 없는 비-USD 원본은 환산 불가(null)", () => {
    expect(formatSalaryKrw({ currency: "GBP", min: 65600, max: 98400 })).toBeNull();
  });

  it("빈 입력은 null", () => {
    expect(formatSalaryKrw(null)).toBeNull();
    expect(formatSalaryKrw({})).toBeNull();
  });
});
