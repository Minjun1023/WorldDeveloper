"use client";

import { useEffect, useState } from "react";

import { ScoreRadar } from "@/components/recommend/ScoreRadar";
import type { ScoreBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

// 홈 "5축 매칭" 설명 섹션 — 정적 레이더 대신 '예시 한 명'으로 매칭 과정을 보여주는 반응형 데모.
// 축 칩을 짚으면(hover/클릭/자동 순환) 레이더의 해당 꼭짓점이 강조되고,
// "내 프로필 ↔ 이 공고"가 그 축에서 어떻게 매칭됐는지 예시 설명이 바뀐다.
const AXES: {
  label: string;
  desc: string;
  // 예시 시나리오: 파이썬 백엔드 6년차, 유럽 선호 ↔ 베를린 핀테크 공고
  mine: string;
  theirs: string;
  score: number; // 0~100 (레이더 SAMPLE 과 일치)
}[] = [
  { label: "스택", desc: "기술 적합도", mine: "python · django · k8s", theirs: "공고: Python · Kubernetes", score: 95 },
  { label: "지역", desc: "선호 국가", mine: "선호: 독일 · 네덜란드", theirs: "공고: Berlin, Germany", score: 85 },
  { label: "레벨", desc: "시니어리티", mine: "시니어 (6년차)", theirs: "공고: Senior Engineer", score: 72 },
  { label: "연봉", desc: "기대 범위", mine: "희망: $95k", theirs: "공고: $90k~$120k", score: 72 },
  { label: "의미", desc: "도메인 관심", mine: "관심: 핀테크 · 결제", theirs: "공고: 결제 플랫폼 팀", score: 90 },
];

// 레이더용 예시 점수 — 위 AXES.score 와 동일 값(0~1 스케일). 비자는 매칭 축이 아니라 미반영.
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

const CYCLE_MS = 2600;

export function MatchAxes() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // 자동 순환 — 사용자가 칩에 올리면(paused) 멈추고 직접 탐색.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((i) => (i + 1) % AXES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const axis = AXES[active];

  return (
    <div
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 좌: 카피 + 축 칩(인터랙티브) */}
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
          {AXES.map((a, i) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              aria-pressed={active === i}
              className={cn(
                "rounded-full border px-4 py-2.5 text-body-sm transition-colors",
                active === i
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card hover:border-primary/30",
              )}
            >
              <span className="font-bold text-primary">{a.label}</span>
              <span className="text-muted-foreground"> · {a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 우: 예시 데모 카드 — 레이더(활성 축 강조) + 축별 매칭 예시 */}
      <div className="flex justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-md sm:p-8">
          <div className="flex items-center justify-between text-caption text-muted-foreground">
            <span>예시 · 파이썬 백엔드 6년차</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              매칭 86점
            </span>
          </div>
          <div className="mt-2 flex justify-center">
            <ScoreRadar score={SAMPLE} size={230} highlightIndex={active} />
          </div>
          {/* 활성 축의 매칭 예시 — 내 프로필 ↔ 공고 */}
          <div
            key={axis.label}
            className="mt-3 rounded-xl bg-muted p-4 duration-300 animate-in fade-in slide-in-from-bottom-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-bold text-primary">{axis.label}</span>
              <span className="text-body-sm font-semibold text-foreground">{axis.score}점</span>
            </div>
            <p className="mt-1.5 text-caption text-muted-foreground">
              <span className="font-medium text-foreground">{axis.mine}</span>
              <span aria-hidden="true"> ↔ </span>
              {axis.theirs}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
