import type { JobVisa } from "@/lib/types";

// sponsors 판정 근거의 신뢰 등급 분류 — "틀린 정보보다 미표시" 원칙의 연장으로,
// 근거의 강도를 숨기지 않고 사용자에게 그대로 보여주기 위한 구분.
// ETL(visa_reclassify)이 생성하는 한국어 근거 문장의 안정적 패턴에 매칭한다.
//   register: 정부 공식 명부/이력 대조 (영국 Home Office · 미국 USCIS H-1B · 네덜란드 IND)
//   direct:   이 공고 본문에 스폰서십 직접 명시
//   indirect: 같은 회사의 다른 공고에서 전파된 간접 신호
export type VisaEvidenceTier = "direct" | "register" | "indirect";

const REGISTER_PATTERN = /명부|라이선스 보유|이력 보유|인정 스폰서/;
const INDIRECT_PATTERN = /다른 공고/;

export function visaEvidenceTier(visa?: JobVisa | null): VisaEvidenceTier | null {
  if (!visa || visa.status !== "sponsors") return null;
  // 서버가 계산한 등급이 있으면 그대로(목록 응답은 evidence 배열이 생략되므로 이것이 유일한 근거).
  if (visa.evidence_tier) return visa.evidence_tier;
  const evidence = visa.evidence ?? [];
  if (visa.register_verified || evidence.some((e) => REGISTER_PATTERN.test(e))) return "register";
  // 근거가 아예 없으면 등급을 주장하지 않는다(direct 로 과잉 표기 방지).
  if (evidence.length === 0) return null;
  if (evidence.every((e) => INDIRECT_PATTERN.test(e))) return "indirect";
  return "direct";
}

export const TIER_LABEL: Record<VisaEvidenceTier, string> = {
  register: "정부 명부 검증",
  direct: "비자 스폰서십 명시",
  indirect: "회사 이력 기반",
};

export const TIER_NOTE: Record<VisaEvidenceTier, string> = {
  register:
    "정부 공식 명부(영국 Home Office · 미국 USCIS · 네덜란드 IND)에서 확인된 회사예요. 명부는 회사 단위 신호라, 공고 소재 국가의 비자 절차는 지원 시 회사와 확인하세요.",
  direct: "이 공고 본문에 비자 스폰서십이 직접 명시돼 있어요.",
  indirect:
    "이 공고 본문에는 비자 언급이 없어요 — 같은 회사의 다른 공고에서 확인된 간접 신호예요. 지원 전 회사에 스폰서십 여부를 직접 확인하는 걸 추천해요.",
};
