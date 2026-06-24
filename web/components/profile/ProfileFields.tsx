"use client";

import { Code2, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TagInput } from "@/components/ui/tag-input";
import { LOCATION_VOCAB } from "@/lib/location-vocab";
import { TECH_VOCAB } from "@/lib/tech-vocab";
import type { RecommendProfile } from "@/lib/types";

const SENIORITY = [
  { value: "entry", label: "신입" },
  { value: "junior", label: "주니어" },
  { value: "mid", label: "미들" },
  { value: "senior", label: "시니어" },
  { value: "staff", label: "스태프" },
  { value: "principal", label: "프린시플" },
];

// 각 단계의 대략적 연차(회사·국가마다 다름 — 참고용). 선택 시 힌트로 보여준다.
const SENIORITY_YEARS: Record<string, string> = {
  entry: "0~1년차",
  junior: "1~3년차",
  mid: "3~5년차",
  senior: "5~9년차",
  staff: "8~12년차",
  principal: "12년차+",
};
const REMOTE = [
  { value: "any", label: "상관없음" },
  { value: "remote", label: "원격" },
  { value: "onsite", label: "이주" },
];
const SALARY_MAX = 250000;

function SectionHead({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h2 className="text-h3">{title}</h2>
        <p className="text-caption text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

export function ProfileFields({
  value,
  onChange,
}: {
  value: RecommendProfile;
  onChange: (next: RecommendProfile) => void;
}) {
  const set = (patch: Partial<RecommendProfile>) => onChange({ ...value, ...patch });
  const salary = value.desired_salary_usd ?? 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <SectionHead
          icon={<Code2 className="h-[18px] w-[18px]" aria-hidden="true" />}
          title="기술 · 경력"
          desc="스택·레벨·소개로 매칭 정확도를 높여요."
        />
        <div className="mt-5 space-y-4">
          <TagInput
            id="skills"
            label="기술 스택"
            hint="입력하면 자동완성 추천"
            value={value.skills}
            onChange={(skills) => set({ skills })}
            suggestions={TECH_VOCAB}
            placeholder="예: Python, Kubernetes…"
          />
          <div className="space-y-1.5">
            <Segmented
              label="시니어리티"
              options={SENIORITY}
              value={value.seniority}
              onChange={(seniority) => set({ seniority })}
            />
            {SENIORITY_YEARS[value.seniority] && (
              <p className="text-caption text-muted-foreground">
                대략 <span className="font-medium text-foreground">{SENIORITY_YEARS[value.seniority]}</span> 경력에 해당해요 (회사·국가마다 달라요).
              </p>
            )}
          </div>
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">
              연차 <span className="font-normal text-muted-foreground">(선택)</span>
            </span>
            <Input
              type="number"
              min={0}
              value={value.years_experience ?? ""}
              onChange={(e) =>
                set({ years_experience: e.target.value ? Number(e.target.value) : undefined })
              }
              className="max-w-[180px] font-mono"
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
              placeholder="한두 문장으로 본인을 소개해 주세요. 의미 매칭에 쓰여요. (예: 대규모 결제 시스템을 운영한 백엔드 엔지니어, 유럽 이주 희망)"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <SectionHead
          icon={<SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />}
          title="선호 근무조건"
          desc="지역·근무형태·연봉으로 우선순위를 맞춰요."
        />
        <div className="mt-5 space-y-4">
          <TagInput
            id="locations"
            label="선호 지역"
            hint="입력하면 자동완성 추천"
            value={value.preferred_locations ?? []}
            onChange={(preferred_locations) => set({ preferred_locations })}
            suggestions={LOCATION_VOCAB}
            placeholder="예: Berlin, Tokyo, Germany…"
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
          <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-caption font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> 비자 스폰서십은 항상 기본 포함돼요.
          </p>
        </div>
      </section>
    </div>
  );
}
