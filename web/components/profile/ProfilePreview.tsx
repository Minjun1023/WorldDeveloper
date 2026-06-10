"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecommendProfile, RecommendResponse } from "@/lib/types";

const DIMS = [
  { key: "stack", label: "기술 스택", color: "var(--score-stack)" },
  { key: "seniority", label: "시니어리티", color: "var(--score-seniority)" },
  { key: "location", label: "선호 지역", color: "var(--score-location)" },
  { key: "visa", label: "비자", color: "var(--score-visa)" },
  { key: "salary", label: "연봉", color: "var(--score-salary)" },
  { key: "semantic", label: "의미 매칭", color: "var(--score-semantic)" },
] as const;

function dimState(p: RecommendProfile, key: string): { active: boolean; note: string } {
  switch (key) {
    case "stack":
      return {
        active: p.skills.length > 0,
        note: p.skills.length
          ? `${p.skills[0]}${p.skills.length > 1 ? ` +${p.skills.length - 1}` : ""}`
          : "미입력",
      };
    case "seniority":
      return { active: true, note: p.seniority };
    case "location": {
      const n = p.preferred_locations?.length ?? 0;
      return { active: n > 0, note: n ? `${n}곳` : "미입력" };
    }
    // 비자 스폰서십은 항상 필요로 가정한다(폼에 토글 없음, 백엔드가 항상 true 강제) — 의도된 동작.
    case "visa":
      return { active: true, note: "필요(기본)" };
    case "salary":
      return {
        active: p.desired_salary_usd != null,
        note: p.desired_salary_usd != null ? `$${Math.round(p.desired_salary_usd / 1000)}k` : "미입력",
      };
    case "semantic":
      return { active: !!p.bio?.trim(), note: p.bio?.trim() ? "자기소개 반영" : "미입력" };
    default:
      return { active: false, note: "" };
  }
}

export function ProfilePreview({ profile }: { profile: RecommendProfile }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profileRef.current),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as RecommendResponse;
      setCount(data.total_candidates ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // 마운트 시 1회만 호출 — 입력마다 호출하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky top-20 space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="border-b border-primary/15 pb-4 text-center">
        {loading ? (
          <p className="text-body-sm text-muted-foreground">계산 중…</p>
        ) : error ? (
          <p className="text-body-sm text-muted-foreground">불러올 수 없어요.</p>
        ) : (
          <p className="text-3xl font-extrabold tabular-nums text-primary">{count ?? "—"}</p>
        )}
        <p className="text-caption text-muted-foreground">개 공고가 지금 프로필과 매칭</p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="mt-2">
          갱신 ↻
        </Button>
      </div>

      <div>
        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          6차원 반영
        </p>
        <ul className="space-y-1.5 text-body-sm">
          {DIMS.map((d) => {
            const s = dimState(profile, d.key);
            return (
              <li key={d.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("h-2 w-2 shrink-0 rounded-full", s.active ? "" : "bg-muted")}
                  style={s.active ? { backgroundColor: d.color } : undefined}
                />
                <span className={s.active ? "" : "text-muted-foreground"}>{d.label}</span>
                <span className="ml-auto text-caption text-muted-foreground">
                  {s.active ? s.note : `→ ${s.note}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
