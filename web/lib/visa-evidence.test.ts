import { describe, expect, it } from "vitest";

import { visaEvidenceTier } from "@/lib/visa-evidence";

describe("visaEvidenceTier", () => {
  it("sponsors 가 아니면 null", () => {
    expect(visaEvidenceTier(undefined)).toBeNull();
    expect(visaEvidenceTier({ status: "unclear" })).toBeNull();
    expect(visaEvidenceTier({ status: "no_sponsor" })).toBeNull();
  });

  it("정부 명부/이력 근거는 register (실제 ETL 문장 패턴)", () => {
    expect(
      visaEvidenceTier({ status: "sponsors", evidence: ["회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"] }),
    ).toBe("register");
    expect(
      visaEvidenceTier({ status: "sponsors", evidence: ["회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)"] }),
    ).toBe("register");
    // register_verified 플래그만으로도 register
    expect(visaEvidenceTier({ status: "sponsors", register_verified: true, evidence: [] })).toBe("register");
  });

  it("같은 회사 다른 공고 전파는 indirect", () => {
    expect(
      visaEvidenceTier({ status: "sponsors", evidence: ["같은 회사의 다른 공고에 비자 스폰서 명시"] }),
    ).toBe("indirect");
  });

  it("본문 명시(그 외 근거)는 direct, 근거가 없으면 null(주장하지 않음)", () => {
    expect(
      visaEvidenceTier({ status: "sponsors", evidence: ["공고 본문에 'visa sponsorship available' 명시"] }),
    ).toBe("direct");
    expect(visaEvidenceTier({ status: "sponsors", evidence: [] })).toBeNull();
  });

  it("서버 계산 등급(evidence_tier)이 있으면 최우선 — 목록 응답은 evidence 배열이 생략됨", () => {
    expect(visaEvidenceTier({ status: "sponsors", evidence_tier: "indirect" })).toBe("indirect");
    expect(visaEvidenceTier({ status: "sponsors", evidence_tier: "direct" })).toBe("direct");
  });

  it("명부 근거가 섞여 있으면 register 가 우선(최강 신호)", () => {
    expect(
      visaEvidenceTier({
        status: "sponsors",
        evidence: ["같은 회사의 다른 공고에 비자 스폰서 명시", "회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"],
      }),
    ).toBe("register");
  });
});
