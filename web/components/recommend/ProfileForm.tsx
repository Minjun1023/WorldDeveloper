"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendProfile } from "@/lib/types";

export function ProfileForm({
  onSubmit,
  loading,
  defaultValue,
  submitLabel = "추천 받기",
  secondaryAction,
}: {
  onSubmit: (profile: RecommendProfile) => void;
  loading: boolean;
  defaultValue?: RecommendProfile;
  submitLabel?: string;
  secondaryAction?: React.ReactNode;
}) {
  const [skills, setSkills] = useState((defaultValue?.skills ?? []).join(", "));
  const [seniority, setSeniority] = useState(defaultValue?.seniority ?? "senior");
  const [years, setYears] = useState(defaultValue?.years_experience?.toString() ?? "");
  const [locations, setLocations] = useState((defaultValue?.preferred_locations ?? []).join(", "));
  const [remote, setRemote] = useState(defaultValue?.remote_preference ?? "any");
  const [salary, setSalary] = useState(defaultValue?.desired_salary_usd?.toString() ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      seniority,
      years_experience: years ? Number(years) : undefined,
      preferred_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
      remote_preference: remote,
      desired_salary_usd: salary ? Number(salary) : undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-body-sm font-medium">기술 스택 (쉼표)</span>
          <Input value={skills} onChange={(e) => setSkills(e.target.value)} className="font-mono" />
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">시니어리티</span>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body-sm"
          >
            {["junior", "mid", "senior", "staff", "principal"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">연차 (선택)</span>
          <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} className="font-mono" />
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">선호 지역 (쉼표)</span>
          <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">원격/이주 선호</span>
          <select
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body-sm"
          >
            <option value="any">상관없음</option>
            <option value="remote">원격 선호</option>
            <option value="onsite">현지 근무(이주)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">최소 희망 연봉 (USD)</span>
          <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="font-mono" />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        {secondaryAction}
        <Button type="submit" disabled={loading}>
          {loading ? "추천 계산 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
