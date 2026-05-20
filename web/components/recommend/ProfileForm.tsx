"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendProfile } from "@/lib/types";

export function ProfileForm({
  onSubmit,
  loading,
}: {
  onSubmit: (profile: RecommendProfile) => void;
  loading: boolean;
}) {
  const [skills, setSkills] = useState("python, django, postgresql, aws");
  const [seniority, setSeniority] = useState("senior");
  const [locations, setLocations] = useState("Berlin, Amsterdam, Remote");
  const [needsVisa, setNeedsVisa] = useState(true);
  const [salary, setSalary] = useState("80000");
  const [bio, setBio] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      seniority,
      bio: bio.trim() || undefined,
      needs_visa_sponsorship: needsVisa,
      preferred_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
      remote_preference: "any",
      desired_salary_usd: salary ? Number(salary) : undefined,
      top_k: 9,
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
          <span className="text-body-sm font-medium">선호 지역 (쉼표)</span>
          <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">최소 희망 연봉 (USD)</span>
          <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="font-mono" />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-body-sm font-medium">자기소개 / 이력서 요약 (의미 매칭용, 선택)</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          placeholder="예: 분산 시스템과 결제 인프라에 관심 많은 백엔드 개발자"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-body-sm">
          <input type="checkbox" checked={needsVisa} onChange={(e) => setNeedsVisa(e.target.checked)} />
          비자 스폰서십 필요
        </label>
        <Button type="submit" disabled={loading}>
          {loading ? "추천 계산 중…" : "추천 받기"}
        </Button>
      </div>
    </form>
  );
}
