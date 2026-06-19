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

const SENIORITY_KO: Record<string, string> = {
  Principal: "프린시플", Staff: "스태프", Lead: "리드", Senior: "시니어", Junior: "주니어", Intern: "인턴", Entry: "신입",
};

export function levelText(years?: number | null, seniority?: string | null): string | null {
  if (seniority === "Entry" || years === 0) return "신입";
  if (seniority) return SENIORITY_KO[seniority] ?? seniority;
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
