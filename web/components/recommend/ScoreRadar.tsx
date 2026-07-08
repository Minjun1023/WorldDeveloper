import type { ScoreBreakdown } from "@/lib/types";

// 5축 점수를 오각형 레이더(거미줄) 차트로 시각화. 차트 라이브러리 없이 순수 SVG.
// 축 순서(상단부터 시계방향): 스택 → 지역 → 레벨 → 연봉 → 의미.
// 비자는 매칭 축이 아니라 기본 필터/검증 배지라 레이더에서 제외한다.
const DIMS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "stack", label: "스택" },
  { key: "location", label: "지역" },
  { key: "seniority", label: "레벨" },
  { key: "salary", label: "연봉" },
  { key: "semantic", label: "의미" },
];

const C = 75; // viewBox 150 중심
const R = 46; // 최대 반지름(라벨 공간 확보)
const RINGS = 4;
const LABEL_R = 60;

const angle = (i: number) => ((-90 + i * 72) * Math.PI) / 180;
const point = (i: number, radius: number): [number, number] => [
  C + radius * Math.cos(angle(i)),
  C + radius * Math.sin(angle(i)),
];
const polygon = (radius: number | ((i: number) => number)) =>
  DIMS.map((_, i) => point(i, typeof radius === "function" ? radius(i) : radius).map((n) => n.toFixed(2)).join(" "))
    .join(" L ");
const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0)); // 누락/NaN 방어

// 라벨 정렬(오각형): 상단=가운데, 우측 2개=왼쪽기준 시작, 좌측 2개=오른쪽기준 끝.
const anchorFor = (i: number) => (i === 0 ? "middle" : i === 1 || i === 2 ? "start" : "end");

export function ScoreRadar({
  score,
  size = 150,
  highlightIndex,
}: {
  score: ScoreBreakdown;
  size?: number;
  // 홈 데모 등에서 특정 축을 강조(꼭짓점 확대·라벨 굵게) — 미지정 시 기존과 동일.
  highlightIndex?: number | null;
}) {
  const ringPaths = Array.from({ length: RINGS }, (_, k) => `M ${polygon((R * (k + 1)) / RINGS)} Z`);
  const dataPath = `M ${polygon((i) => R * clamp01(score[DIMS[i].key] as number))} Z`;

  return (
    <svg
      viewBox="0 0 150 150"
      width={size}
      height={size}
      role="img"
      aria-label="5축 매칭 점수 차트"
      className="overflow-visible"
    >
      {/* 동심 오각형 그리드 */}
      {ringPaths.map((d, k) => (
        <path key={k} d={d} fill="none" style={{ stroke: "hsl(var(--border))" }} strokeWidth={1} />
      ))}
      {/* 축 선 */}
      {DIMS.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} style={{ stroke: "hsl(var(--border))" }} strokeWidth={1} />;
      })}
      {/* 점수 영역 */}
      <path
        d={dataPath}
        style={{ fill: "color-mix(in srgb, hsl(var(--primary)) 15%, transparent)", stroke: "hsl(var(--primary))" }}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* 데이터 포인트 — 강조 축은 크게 + 링 */}
      {DIMS.map((d, i) => {
        const [x, y] = point(i, R * clamp01(score[d.key] as number));
        const active = highlightIndex === i;
        return (
          <g key={d.key}>
            {active && (
              <circle
                cx={x}
                cy={y}
                r={6}
                style={{ fill: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" }}
                className="transition-all duration-300"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={active ? 3.6 : 2.4}
              style={{ fill: "hsl(var(--primary))" }}
              className="transition-all duration-300"
            />
          </g>
        );
      })}
      {/* 축 라벨 — 강조 축은 primary·굵게 */}
      {DIMS.map((d, i) => {
        const [x, y] = point(i, LABEL_R);
        const active = highlightIndex === i;
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            fontSize={9}
            fontWeight={active ? 700 : 400}
            textAnchor={anchorFor(i)}
            dominantBaseline="middle"
            style={{ fill: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
            className="transition-all duration-300"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
