"use client";

import { useEffect, useState } from "react";

import { ProfileForm } from "@/components/recommend/ProfileForm";
import type { RecommendProfile } from "@/lib/types";

export function ProfileEditor() {
  const [loaded, setLoaded] = useState<RecommendProfile | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.exists && d.profile) setLoaded(d.profile); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  async function save(profile: RecommendProfile) {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  return (
    <div className="space-y-3">
      <ProfileForm onSubmit={save} loading={saving} defaultValue={loaded} submitLabel="저장" />
      {saved && <p className="text-body-sm text-success">저장됐어요.</p>}
      {error && <p className="text-body-sm text-destructive">{error}</p>}
    </div>
  );
}
