"use client";

import { useEffect, useState } from "react";

import { ProfileFields } from "@/components/profile/ProfileFields";
import { ProfilePreview } from "@/components/profile/ProfilePreview";
import { Button } from "@/components/ui/button";
import { clearRecommendCache } from "@/lib/recommend-cache";
import type { RecommendProfile } from "@/lib/types";

const EMPTY: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

export function ProfileEditor() {
  const [profile, setProfile] = useState<RecommendProfile>(EMPTY);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.exists && d.profile) setProfile({ ...EMPTY, ...d.profile });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function update(next: RecommendProfile) {
    setProfile(next);
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
      clearRecommendCache(); // 프로필 변경 → 추천 캐시 무효화(다음 방문 시 신선하게 재계산)
      setSaved(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ProfileFields value={profile} onChange={update} />
      {/* 미리보기 카드 + 저장 버튼을 한 덩어리로 sticky — 카드만 sticky 면 스크롤 시 저장 버튼이
          카드 위로 겹쳐 보이던 버그를 막는다. */}
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <ProfilePreview profile={profile} />
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "저장 중…" : "저장"}
        </Button>
        {dirty && !saved && (
          <p className="text-center text-caption text-muted-foreground">변경사항 있음</p>
        )}
        {saved && <p className="text-center text-body-sm text-success">저장됐어요.</p>}
        {error && <p className="text-center text-body-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
