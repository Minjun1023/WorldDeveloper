import type { RecommendProfile } from "@/lib/types";

// 추천 6차원 — 색은 globals.css 의 --score-* 토큰과 일치. 비자·시니어리티는 항상 기본 반영.
export const PROFILE_DIMS = [
  { key: "stack", label: "기술 스택", color: "var(--score-stack)" },
  { key: "seniority", label: "시니어리티", color: "var(--score-seniority)" },
  { key: "location", label: "선호 지역", color: "var(--score-location)" },
  { key: "visa", label: "비자", color: "var(--score-visa)" },
  { key: "salary", label: "연봉", color: "var(--score-salary)" },
  { key: "semantic", label: "의미 매칭", color: "var(--score-semantic)" },
] as const;

export const DIM_TOTAL = PROFILE_DIMS.length; // 6

export function dimState(p: RecommendProfile, key: string): { active: boolean; note: string } {
  switch (key) {
    case "stack":
      return {
        active: p.skills.length > 0,
        note: p.skills.length
          ? `${p.skills[0]}${p.skills.length > 1 ? ` +${p.skills.length - 1}` : ""}`
          : "입력 필요",
      };
    case "seniority":
      return { active: true, note: p.seniority };
    case "location": {
      const n = p.preferred_locations?.length ?? 0;
      return { active: n > 0, note: n ? `${n}곳` : "입력 필요" };
    }
    // 비자 스폰서십은 항상 필요로 가정(폼에 토글 없음, 백엔드가 항상 true 강제) — 의도된 동작.
    case "visa":
      return { active: true, note: "필요 · 기본" };
    case "salary":
      return {
        active: p.desired_salary_usd != null,
        note: p.desired_salary_usd != null ? `$${Math.round(p.desired_salary_usd / 1000)}k` : "입력 필요",
      };
    case "semantic":
      return { active: !!p.bio?.trim(), note: p.bio?.trim() ? "자기소개 반영" : "입력 필요" };
    default:
      return { active: false, note: "" };
  }
}

// 반영된 차원 수(6 중) — 헤더 완성도 칩과 6차원 패널이 같은 기준을 쓰도록.
export function reflectedCount(p: RecommendProfile): number {
  return PROFILE_DIMS.filter((d) => dimState(p, d.key).active).length;
}
