"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { ScoreRadar } from "@/components/recommend/ScoreRadar";
import { useMatchScore } from "@/lib/use-match-score";
import type { ScoreBreakdown } from "@/lib/types";

// 5축 — 비자는 매칭 축이 아니라 기본 필터/검증 배지라 제외.
const AXES: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "stack", label: "스택" },
  { key: "location", label: "지역" },
  { key: "seniority", label: "레벨" },
  { key: "salary", label: "연봉" },
  { key: "semantic", label: "의미" },
];

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, Number(n) || 0)) * 100);

export function MatchScorePanel({ jobId }: { jobId: string }) {
  const { state, score, retry } = useMatchScore(jobId);

  if (state === "loading") {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl border border-border bg-surface-2"
        aria-hidden
      />
    );
  }

  // 백엔드 응답 실패/지연 시: 패널을 숨기지 않고 다시 시도할 수 있게 안내.
  if (state === "error") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-body-sm font-semibold">매칭 점수를 불러오지 못했어요</p>
        <p className="mt-1 text-caption text-muted-foreground">
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded-[10px] border border-border px-4 py-2 text-body-sm font-semibold transition-colors hover:bg-accent"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state === "loggedOut" || state === "needsProfile") {
    const cta =
      state === "loggedOut"
        ? { href: "/signin", label: "로그인하고 내 매칭 보기" }
        : { href: "/onboarding/profile", label: "프로필 작성하고 매칭 보기" };

    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 text-center">
        {/* blurred fake score teaser */}
        <div className="pointer-events-none select-none blur-sm" aria-hidden>
          <div className="text-5xl font-extrabold">
            78<span className="text-base text-muted-foreground">/100</span>
          </div>
          <div className="mt-3 space-y-2">
            {AXES.map((a) => (
              <div key={a.key} className="h-2 rounded-full bg-surface-2" />
            ))}
          </div>
        </div>
        {/* CTA overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5">
          <p className="text-body-sm font-semibold">내 프로필과 얼마나 맞을까요?</p>
          <Link
            href={cta.href}
            className="rounded-[10px] bg-primary px-4 py-2 text-body-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    );
  }

  // state === "ready"
  const s = score as ScoreBreakdown;
  const total = pct(s.final_score);
  const quality =
    total >= 85 ? "매우 높은 일치도" : total >= 70 ? "높은 일치도" : total >= 50 ? "보통 일치도" : "일치도 낮음";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">내 프로필과 매칭도</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-extrabold leading-none tabular-nums text-foreground">{total}</span>
        <span className="pb-0.5 text-body-sm font-semibold text-muted-foreground">/ 100점</span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-caption font-bold text-success">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {quality}
      </p>

      <div className="mt-4 flex justify-center">
        <ScoreRadar score={s} size={220} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
        {AXES.map((a) => (
          <div key={a.key} className="flex items-center justify-between text-caption">
            <span className="text-muted-foreground">{a.label}</span>
            <span className="font-bold tabular-nums text-foreground">{pct(s[a.key] as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
