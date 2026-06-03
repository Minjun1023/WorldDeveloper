"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProfileForm } from "@/components/recommend/ProfileForm";
import type { RecommendProfile } from "@/lib/types";

export function OnboardingProfile() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(profile: RecommendProfile) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function skip() {
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-body-sm text-muted-foreground">맞춤 공고 추천을 위한 프로필 (선택 — 건너뛰어도 시작할 수 있어요)</p>
      <ProfileForm
        onSubmit={save}
        loading={saving}
        submitLabel="완료"
        secondaryAction={
          <button
            type="button"
            onClick={skip}
            className="text-body-sm text-muted-foreground hover:text-foreground"
          >
            건너뛰기
          </button>
        }
      />
      {error && <p className="text-destructive text-body-sm">{error}</p>}
    </div>
  );
}
