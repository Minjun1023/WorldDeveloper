"use client";

import { useState } from "react";

import { REMOTE, SALARY_MAX, SENIORITY, SENIORITY_YEARS } from "@/components/profile/ProfileFields";
import { ProfilePreview } from "@/components/profile/ProfilePreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { LOCATION_VOCAB } from "@/lib/location-vocab";
import { TECH_VOCAB } from "@/lib/tech-vocab";
import { cn } from "@/lib/utils";
import type { RecommendProfile } from "@/lib/types";

// 최초 프로필 작성용 단계 모달 — MBTI 검사처럼 한 화면에 질문 하나씩(2026-07).
// 이미 작성한 프로필의 수정은 기존 폼(ProfileFields)이 담당한다.
const STEPS = [
  { key: "skills", title: "어떤 기술 스택을 쓰시나요?", desc: "입력하면 자동완성으로 골라드려요. 3개 정도면 충분해요." },
  { key: "seniority", title: "지금 레벨은 어디쯤인가요?", desc: "회사·국가마다 달라요 — 가장 가까운 쪽을 골라주세요." },
  { key: "years", title: "경력은 몇 년차인가요?", desc: "선택 사항이에요. 비워두고 넘어가도 돼요." },
  { key: "locations", title: "어디에서 일하고 싶으세요?", desc: "나라든 도시든 좋아요. 여러 곳도 괜찮아요." },
  { key: "remote", title: "원격과 이주, 어느 쪽인가요?", desc: "추천 우선순위에 반영돼요." },
  { key: "salary", title: "희망 연봉이 있나요?", desc: "선택 사항이에요. 0에 두면 미설정으로 넘어가요." },
  { key: "bio", title: "한두 문장으로 소개해 주세요", desc: "선택 사항 — 의미 매칭에 쓰여요." },
  { key: "done", title: "준비 끝! 이렇게 반영돼요", desc: "저장하면 바로 맞춤 추천이 시작돼요." },
] as const;

// 원격/이주 선택 카드 — 폼(Segmented)보다 큰 카드로, 한 줄 설명을 붙인다.
const REMOTE_DESC: Record<string, string> = {
  any: "원격·이주 모두 열려 있어요",
  remote: "지금 사는 곳에서 원격으로",
  onsite: "현지로 이주해서 일할래요",
};

// 선택형 스텝의 답변 카드. 클릭하면 잠깐의 하이라이트 후 자동으로 다음 질문으로.
function ChoiceCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
      )}
    >
      {children}
    </button>
  );
}

export function ProfileWizard({
  open,
  onOpenChange,
  initial,
  onComplete,
  saving = false,
  ctaLabel = "저장",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RecommendProfile;
  onComplete: (profile: RecommendProfile) => void;
  saving?: boolean;
  ctaLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<RecommendProfile>(initial);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const set = (patch: Partial<RecommendProfile>) => setDraft((d) => ({ ...d, ...patch }));
  const next = () => setI((n) => Math.min(n + 1, STEPS.length - 1));
  const back = () => setI((n) => Math.max(n - 1, 0));
  // 답변 카드 클릭 → 선택이 눈에 보이게 잠깐 두고 자동 진행 (MBTI 검사 리듬).
  const selectAndAdvance = (patch: Partial<RecommendProfile>) => {
    set(patch);
    setTimeout(next, 240);
  };

  const salary = draft.desired_salary_usd ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] max-w-xl gap-0 overflow-y-auto rounded-2xl p-6 sm:p-8"
        // 실수로 바깥을 눌러 진행 중인 답변이 날아가지 않게 — 닫기는 X/Esc 로만.
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* 진행 표시 */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="text-caption tabular-nums text-muted-foreground">
            {i + 1}/{STEPS.length}
          </span>
        </div>

        {/* 질문 + 입력 — 스텝 전환마다 우측에서 슬라이드 인 */}
        <div key={step.key} className="duration-300 animate-in fade-in slide-in-from-right-2">
          <DialogTitle className="text-h2">{step.title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-body-sm">{step.desc}</DialogDescription>

          <div className="mt-6">
            {step.key === "skills" && (
              <TagInput
                id="wizard-skills"
                label="기술 스택"
                hint="입력하면 자동완성 추천"
                value={draft.skills}
                onChange={(skills) => set({ skills })}
                suggestions={TECH_VOCAB}
                placeholder="예: Python, Kubernetes…"
              />
            )}

            {step.key === "seniority" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {SENIORITY.map((s) => (
                  <ChoiceCard
                    key={s.value}
                    selected={draft.seniority === s.value}
                    onSelect={() => selectAndAdvance({ seniority: s.value })}
                  >
                    <span className="block text-body-sm font-bold">{s.label}</span>
                    <span className="mt-0.5 block text-caption text-muted-foreground">
                      대략 {SENIORITY_YEARS[s.value]}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            )}

            {step.key === "years" && (
              <label className="block space-y-1.5">
                <span className="text-body-sm font-medium">연차</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.years_experience ?? ""}
                  onChange={(e) =>
                    set({ years_experience: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="max-w-[180px] font-mono"
                />
              </label>
            )}

            {step.key === "locations" && (
              <TagInput
                id="wizard-locations"
                label="선호 지역"
                hint="입력하면 자동완성 추천"
                value={draft.preferred_locations ?? []}
                onChange={(preferred_locations) => set({ preferred_locations })}
                suggestions={LOCATION_VOCAB}
                placeholder="예: Berlin, Tokyo, Germany…"
              />
            )}

            {step.key === "remote" && (
              <div className="grid gap-2 sm:grid-cols-3">
                {REMOTE.map((r) => (
                  <ChoiceCard
                    key={r.value}
                    selected={draft.remote_preference === r.value}
                    onSelect={() => selectAndAdvance({ remote_preference: r.value })}
                  >
                    <span className="block text-body-sm font-bold">{r.label}</span>
                    <span className="mt-0.5 block text-caption text-muted-foreground">
                      {REMOTE_DESC[r.value]}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            )}

            {step.key === "salary" && (
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
            )}

            {step.key === "bio" && (
              <textarea
                value={draft.bio ?? ""}
                onChange={(e) => set({ bio: e.target.value })}
                rows={3}
                placeholder="예: 대규모 결제 시스템을 운영한 백엔드 엔지니어, 유럽 이주 희망"
                className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-body-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}

            {step.key === "done" && <ProfilePreview profile={draft} />}
          </div>
        </div>

        {/* 내비게이션 */}
        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={back} disabled={i === 0}>
            이전
          </Button>
          {last ? (
            <Button type="button" onClick={() => onComplete(draft)} disabled={saving}>
              {saving ? "저장 중…" : ctaLabel}
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              다음
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
