"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
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

export function ProfileEditor({ welcome = false }: { welcome?: boolean }) {
  const router = useRouter();
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

  // 저장 안 된 변경이 있을 때 탭 닫기/새로고침 이탈 경고 (클라 내비게이션은 App Router 제약상 미커버).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
        if (res.status === 400) throw new Error(msg ?? "입력값을 확인해주세요.");
        throw new Error(`저장 실패 (HTTP ${res.status})`);
      }
      clearRecommendCache(); // 프로필 변경 → 추천 캐시 무효화(다음 방문 시 신선하게 재계산)
      setSaved(true);
      setDirty(false);
      // 환영 모드(가입 직후): 저장 즉시 첫 가치 경험(맞춤 추천)으로 이동.
      if (welcome) {
        router.push("/recommend");
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const reflected = reflectedCount(profile);

  return (
    <div className="space-y-6">
      {/* 가입 직후 환영 배너 — 프로필의 '왜'를 설명하고, 건너뛸 자유도 함께 준다. */}
      {welcome && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-body font-bold text-foreground">환영합니다! 프로필을 채우면 5축 매칭 추천이 시작돼요</p>
              <p className="mt-0.5 text-body-sm text-muted-foreground">
                스택·지역 정도만 넣어도 충분해요. 저장하면 바로 맞춤 공고를 보여드려요.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="link"
            onClick={() => router.push("/search")}
            className="h-auto shrink-0 self-start p-0 text-muted-foreground hover:text-foreground sm:self-center"
          >
            나중에 하고 둘러보기
          </Button>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-end gap-4">
        {ready && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <span className="text-body-sm font-bold tabular-nums">
              {reflected}/{DIM_TOTAL}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: DIM_TOTAL }).map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 w-4 rounded-full", i < reflected ? "bg-primary" : "bg-muted")}
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
