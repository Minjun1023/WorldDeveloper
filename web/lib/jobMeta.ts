import type { Job } from "@/lib/types";

// 고용형태 라벨 — 소스별 표기 차이를 흡수(영문자만 남겨 대문자 매칭). 미매칭이면 원문 유지.
const EMP_LABEL: Record<string, string> = {
  FULLTIME: "정규직",
  PARTTIME: "파트타임",
  CONTRACT: "계약직", CONTRACTOR: "계약직", CONTRACTTOHIRE: "계약직",
  TEMPORARY: "임시직", TEMP: "임시직",
  INTERN: "인턴", INTERNSHIP: "인턴",
  FREELANCE: "프리랜서",
};

export function employmentLabel(raw?: string | null): string {
  if (!raw) return "고용형태 미표기";
  return EMP_LABEL[raw.toUpperCase().replace(/[^A-Z]/g, "")] ?? raw;
}

// 직급 라벨 → 대표 경력연수(최소 기준). 라벨('스태프')과 연수('8년+') 혼용을 'N년+' 한 형식으로
// 통일하기 위한 환산표. 임계값은 백엔드 매칭(Seniority)·프로필 선택기와 동일 기준.
const SENIORITY_YEARS_PLUS: Record<string, string> = {
  Principal: "12년+", Staff: "8년+", Lead: "7년+", Senior: "5년+", Junior: "1년+",
};

// 경력 표기를 'N년+' 한 형식으로 통일. 직급 라벨이 있으면 대표 연수로 환산(추정), 라벨 없이
// 요구 연수만 있으면 그 값을 그대로. 신입/인턴은 연수보다 명확해 라벨 유지.
export function levelText(years?: number | null, seniority?: string | null): string | null {
  if (seniority === "Entry" || years === 0) return "신입";
  if (seniority === "Intern") return "인턴";
  if (seniority) return SENIORITY_YEARS_PLUS[seniority] ?? (years != null ? `${years}년+` : seniority);
  if (years != null) return `${years}년+`;
  return null;
}

// 기술 태그가 없는 공고의 리스트 카드용 중립 칩 텍스트(레벨 우선, 없으면 고용형태). 둘 다 없으면 null.
export function fallbackMetaChip(
  job: Pick<Job, "seniority" | "employment_type"> & { experience_years?: number | null },
): string | null {
  const level = levelText(job.experience_years ?? null, job.seniority);
  if (level) return level;
  if (job.employment_type) return employmentLabel(job.employment_type);
  return null;
}
