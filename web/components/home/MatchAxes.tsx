import { ScoreRadar } from "@/components/recommend/ScoreRadar";
import type { ScoreBreakdown } from "@/lib/types";

// 홈 "5축 매칭" 설명 섹션 — 검증된 기업들과 FAQ 사이.
// 좌: 5축 카피 + 축 목록 / 우: 오각형 레이더(추천/공고 상세와 동일한 ScoreRadar 재사용).
const AXES: { label: string; desc: string }[] = [
  { label: "스택", desc: "기술 적합도" },
  { label: "지역", desc: "선호 국가" },
  { label: "레벨", desc: "시니어리티" },
  { label: "연봉", desc: "기대 범위" },
  { label: "의미", desc: "도메인 관심" },
];

// 시각 예시용 점수(실제 점수는 로그인 후 추천/공고 상세에서 계산). 비자는 매칭 축이 아니라 미반영.
const SAMPLE: ScoreBreakdown = {
  final_score: 0.86,
  stack: 0.95,
  visa: 1,
  location: 0.85,
  seniority: 0.72,
  salary: 0.72,
  semantic: 0.9,
  penalty_applied: 0,
  reasons: [],
  deal_breakers: [],
};

export function MatchAxes() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* 좌: 카피 + 축 목록 */}
      <div>
        <h2 className="text-h1">
          점수 하나가 아니라,
          <br />
          5개의 이유로 추천합니다.
        </h2>
        <p className="mt-4 max-w-md text-body-lg text-muted-foreground">
          검색은 키워드로 찾고, 추천은 내 프로필을 5가지로 매칭합니다. 비자 스폰서십은 기본으로 거르고,
          시니어리티는 항상 반영해 ‘지원할 만한지’부터 확실하게 합니다.
        </p>
        {/* 5개(홀수)를 2열 그리드에 넣으면 마지막 칩이 홀로 남아 어색 — 유동 칩(flex-wrap)으로. */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          {AXES.map((a) => (
            <div
              key={a.label}
              className="rounded-full border border-border bg-surface px-4 py-2.5 text-body-sm"
            >
              <span className="font-bold text-primary">{a.label}</span>
              <span className="text-muted-foreground"> · {a.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 우: 오각형 레이더 */}
      <div className="flex justify-center">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
          <ScoreRadar score={SAMPLE} size={260} />
        </div>
      </div>
    </div>
  );
}
