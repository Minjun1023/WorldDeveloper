"use client";

import { useEffect, useState } from "react";

import { ProfileFields } from "@/components/profile/ProfileFields";
import { ProfilePreview } from "@/components/profile/ProfilePreview";
import { WithdrawSection } from "@/components/profile/WithdrawSection";
import { Button } from "@/components/ui/button";
import { DIM_TOTAL, reflectedCount } from "@/lib/profile-dimensions";
import { clearRecommendCache } from "@/lib/recommend-cache";
import { cn } from "@/lib/utils";
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
  const [communityHandle, setCommunityHandle] = useState(""); // 현재 표시되는 닉네임(자동 포함)

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.exists && d.profile) setProfile({ ...EMPTY, ...d.profile });
        if (d?.community_handle) setCommunityHandle(d.community_handle);
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
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.message;
        if (res.status === 409) throw new Error(msg ?? "이미 사용 중인 닉네임이에요.");
        if (res.status === 400) throw new Error(msg ?? "입력값을 확인해주세요.");
        throw new Error(`저장 실패 (HTTP ${res.status})`);
      }
      clearRecommendCache(); // 프로필 변경 → 추천 캐시 무효화(다음 방문 시 신선하게 재계산)
      // 저장 성공 → 닉네임 표시 갱신(설정값 있으면 그것, 없으면 기존 자동 닉네임 유지)
      const h = (profile.handle ?? "").trim();
      if (h) setCommunityHandle(h);
      setSaved(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const reflected = reflectedCount(profile);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display">프로필</h1>
          <p className="mt-2 text-muted-foreground">
            채울수록 <strong className="font-semibold text-foreground">5축 매칭</strong>이 정확해져요.
            비자 스폰서십은 기본 포함이에요.
          </p>
        </div>
        {ready && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-sm">
            <span className="text-body-sm font-bold tabular-nums">
              {reflected}/{DIM_TOTAL}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: DIM_TOTAL }).map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 w-4 rounded-full", i < reflected ? "bg-primary" : "bg-surface-2")}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {!ready ? (
        <p className="text-body-sm text-muted-foreground">불러오는 중…</p>
      ) : (
        <>
          {/* 커뮤니티 닉네임 */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <label htmlFor="handle" className="text-body-sm font-medium">커뮤니티 닉네임</label>
            <p className="mt-0.5 text-caption text-muted-foreground">
              해외취업 라운지에 표시될 이름이에요. 비워두면 자동 닉네임이 쓰여요.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <input
                id="handle"
                value={profile.handle ?? ""}
                onChange={(e) => update({ ...profile, handle: e.target.value })}
                maxLength={20}
                placeholder={communityHandle || "닉네임 (2~20자)"}
                className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-caption text-muted-foreground">
                현재 표시: <strong className="font-semibold text-foreground">{(profile.handle ?? "").trim() || communityHandle || "—"}</strong>
              </span>
            </div>
          </div>

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
              <p className="text-center text-caption text-muted-foreground">
                변경사항 있음 · 저장하면 추천에 반영돼요
              </p>
            )}
            {saved && <p className="text-center text-body-sm text-success">저장됐어요.</p>}
            {error && <p className="text-center text-body-sm text-destructive">{error}</p>}
          </div>
          </div>
          <WithdrawSection />
        </>
      )}
    </div>
  );
}
