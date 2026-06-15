"use client";

import Link from "next/link";

import { useMatchScore } from "@/lib/use-match-score";
import type { ScoreBreakdown } from "@/lib/types";

const AXES: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "stack", label: "스택" },
  { key: "visa", label: "비자" },
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
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-caption text-muted-foreground">매칭 점수</div>
      <div className="mt-1 text-5xl font-extrabold leading-none">
        {pct(s.final_score)}
        <span className="text-base font-semibold text-muted-foreground">/100</span>
      </div>
      <dl className="mt-4 space-y-2">
        {AXES.map((a) => {
          const v = pct(s[a.key] as number);
          return (
            <div key={a.key} className="flex items-center gap-2 text-caption">
              <dt className="w-8 shrink-0 text-muted-foreground">{a.label}</dt>
              <dd className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${v}%` }}
                />
              </dd>
              <span className="w-7 shrink-0 text-right tabular-nums text-muted-foreground">
                {v}
              </span>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
