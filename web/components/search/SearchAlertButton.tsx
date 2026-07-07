"use client";

import { Bell, BellRing } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { cn } from "@/lib/utils";

// 현재 검색 조건을 저장하고 매일 신규 공고를 이메일로 받는 구독 토글.
// 백엔드 SavedSearchParams 와 1:1 매핑(JSONB) — 같은 조건의 구독이 이미 있으면 '구독 중'으로 표시.
type Params = {
  q: string | null;
  visa: string | null;
  location: string | null;
  remote: boolean | null;
  sort: string | null;
  discipline: string | null;
  region: string | null;
  track: string | null;
  includeUnclear: boolean;
};

type Saved = { id: string; label: string; params: Partial<Params> };

export function SearchAlertButton({ regions, loggedIn = false }: { regions: RegionCount[]; loggedIn?: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [subscribedId, setSubscribedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const params: Params = useMemo(
    () => ({
      q: sp.get("q") || null,
      visa: sp.get("visa") || null,
      location: null,
      remote: sp.get("remote") === "true" ? true : null,
      sort: null,
      discipline: sp.get("discipline") || null,
      region: sp.get("region") || null,
      track: sp.get("track") || null,
      includeUnclear: sp.get("include_unclear") === "true",
    }),
    [sp],
  );

  // 자동 라벨: "미국 · 백엔드 · react" 처럼 사람이 읽는 요약.
  const label = useMemo(() => {
    const parts: string[] = [];
    if (params.region) {
      const labels = params.region.split(",").map((v) => {
        const r = regions.find((x) => x.value === v.trim());
        return r?.label ?? v.trim();
      });
      parts.push(labels.slice(0, 2).join("·") + (labels.length > 2 ? " 외" : ""));
    }
    if (params.discipline) {
      parts.push(DISCIPLINES.find((d) => d.value === params.discipline)?.label ?? params.discipline);
    }
    if (params.remote) parts.push("원격");
    if (params.q) parts.push(`'${params.q}'`);
    return parts.join(" · ") || "전체 공고";
  }, [params, regions]);

  // 같은 조건(핵심 필드 기준)의 기존 구독 탐색 → 토글 초기 상태.
  // 비로그인이면 조회 자체를 건너뜀 — 401 콘솔 에러 노이즈 방지(구독 여부가 있을 수 없음).
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    fetch("/api/me/searches")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Saved[]) => {
        if (!alive || !Array.isArray(list)) return;
        const same = list.find(
          (s) =>
            (s.params?.q ?? null) === params.q &&
            (s.params?.region ?? null) === params.region &&
            (s.params?.discipline ?? null) === params.discipline &&
            (s.params?.remote ?? null) === params.remote,
        );
        setSubscribedId(same?.id ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [params, loggedIn]);

  async function toggle() {
    if (pending) return;
    // 비로그인은 POST 401 왕복 없이 바로 로그인으로 (콘솔 에러 없이 동일한 UX).
    if (!loggedIn) {
      router.push(`/signin?callbackUrl=${encodeURIComponent(`/search?${sp.toString()}`)}`);
      return;
    }
    setPending(true);
    try {
      if (subscribedId) {
        const res = await fetch(`/api/me/searches/${subscribedId}`, { method: "DELETE" });
        if (res.ok) setSubscribedId(null);
        return;
      }
      const res = await fetch("/api/me/searches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, params }),
      });
      if (res.status === 401) {
        router.push(`/signin?callbackUrl=${encodeURIComponent(`/search?${sp.toString()}`)}`);
        return;
      }
      if (res.ok) {
        const created = (await res.json()) as Saved;
        setSubscribedId(created.id ?? "created");
      }
    } finally {
      setPending(false);
    }
  }

  const on = !!subscribedId;
  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "매일 새 공고 알림을 받는 중 — 눌러서 해제" : "이 검색의 새 공고를 매일 이메일로 받기"}
      className={cn(
        // 구독 중(on) 상태 표시는 variant 에 없어 tint 오버라이드로 유지.
        on && "border-primary/40 bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary",
      )}
    >
      {on ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
      {on ? "알림 받는 중" : "알림 받기"}
    </Button>
  );
}
