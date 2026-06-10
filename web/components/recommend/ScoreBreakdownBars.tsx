import type { ScoreBreakdown } from "@/lib/types";

const DIMS: { key: keyof ScoreBreakdown; label: string; color: string }[] = [
  { key: "stack", label: "스택", color: "var(--score-stack)" },
  { key: "visa", label: "비자", color: "var(--score-visa)" },
  { key: "location", label: "지역", color: "var(--score-location)" },
  { key: "seniority", label: "레벨", color: "var(--score-seniority)" },
  { key: "salary", label: "연봉", color: "var(--score-salary)" },
  { key: "semantic", label: "의미", color: "var(--score-semantic)" },
];

// 6차원 점수 시각화 — 순수 CSS 가로 막대(라벨 + 트랙 + 6색 채움 + 점수).
// 시그니처 색 팔레트(globals.css --score-*)를 그대로 사용. 차트 라이브러리 불필요.
export function ScoreBreakdownBars({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="space-y-1.5">
      {DIMS.map((d) => {
        const value = Math.round((score[d.key] as number) * 100);
        return (
          <div key={d.key} className="flex items-center gap-2.5">
            <span className="w-6 shrink-0 text-caption text-muted-foreground">{d.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${value}%`, backgroundColor: d.color }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-caption tabular-nums text-muted-foreground">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
