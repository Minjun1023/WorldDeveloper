"use client";

import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TagInput } from "@/components/ui/tag-input";
import type { RecommendProfile } from "@/lib/types";

const SENIORITY = ["junior", "mid", "senior", "staff", "principal"].map((v) => ({
  value: v,
  label: v,
}));
const REMOTE = [
  { value: "any", label: "상관없음" },
  { value: "remote", label: "원격" },
  { value: "onsite", label: "이주" },
];
const SALARY_MAX = 250000;

function completeness(p: RecommendProfile): number {
  let n = 0;
  if (p.skills.length) n++;
  if (p.years_experience != null) n++;
  if ((p.preferred_locations?.length ?? 0) > 0) n++;
  if (p.desired_salary_usd != null) n++;
  if (p.bio?.trim()) n++;
  return n;
}

export function ProfileFields({
  value,
  onChange,
}: {
  value: RecommendProfile;
  onChange: (next: RecommendProfile) => void;
}) {
  const set = (patch: Partial<RecommendProfile>) => onChange({ ...value, ...patch });
  const filled = completeness(value);
  const salary = value.desired_salary_usd ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between text-caption text-muted-foreground">
          <span>프로필 완성도</span>
          <span className="tabular-nums">{filled} / 5</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary"
            style={{ width: `${(filled / 5) * 100}%` }}
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          기술 · 경력
        </legend>
        <TagInput
          id="skills"
          label="기술 스택"
          value={value.skills}
          onChange={(skills) => set({ skills })}
          placeholder="React, Go… Enter로 추가"
        />
        <Segmented
          label="시니어리티"
          options={SENIORITY}
          value={value.seniority}
          onChange={(seniority) => set({ seniority })}
        />
        <label className="block space-y-1.5">
          <span className="text-body-sm font-medium">연차 (선택)</span>
          <Input
            type="number"
            value={value.years_experience ?? ""}
            onChange={(e) =>
              set({ years_experience: e.target.value ? Number(e.target.value) : undefined })
            }
            className="font-mono"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-body-sm font-medium">
            자기소개{" "}
            <span className="font-normal text-muted-foreground">(의미 매칭에 사용)</span>
          </span>
          <textarea
            value={value.bio ?? ""}
            onChange={(e) => set({ bio: e.target.value })}
            rows={3}
            placeholder="한두 문장으로 본인을 소개해 주세요."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          선호 근무조건
        </legend>
        <TagInput
          id="locations"
          label="선호 지역"
          value={value.preferred_locations ?? []}
          onChange={(preferred_locations) => set({ preferred_locations })}
          placeholder="Berlin, Amsterdam…"
        />
        <Segmented
          label="원격 / 이주"
          options={REMOTE}
          value={value.remote_preference ?? "any"}
          onChange={(remote_preference) => set({ remote_preference })}
        />
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-body-sm font-medium">
            희망 연봉
            <span className="tabular-nums text-primary">
              {salary ? `$${Math.round(salary / 1000)}k` : "미설정"}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={SALARY_MAX}
            step={5000}
            value={salary}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ desired_salary_usd: v === 0 ? undefined : v });
            }}
            aria-label="희망 연봉"
            className="w-full accent-primary"
          />
        </label>
        <p className="text-caption text-muted-foreground">🛡 비자 스폰서십은 기본 포함돼요.</p>
      </fieldset>

      <details className="rounded-lg border border-border bg-surface px-5 py-3">
        <summary className="cursor-pointer text-body-sm text-muted-foreground">고급</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">추천 개수 (top_k)</span>
            <Input
              type="number"
              value={value.top_k ?? ""}
              onChange={(e) => set({ top_k: e.target.value ? Number(e.target.value) : undefined })}
              className="font-mono"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">회사당 최대 (max_per_company)</span>
            <Input
              type="number"
              value={value.max_per_company ?? ""}
              onChange={(e) =>
                set({ max_per_company: e.target.value ? Number(e.target.value) : undefined })
              }
              className="font-mono"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
