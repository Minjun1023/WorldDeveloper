"use client";

import { useEffect, useState } from "react";

import { RecoveryPanel } from "@/components/me/RecoveryPanel";
import { Badge } from "@/components/ui/badge";

interface AppItem {
  job_id: string;
  status: string;
  notes?: string;
  updated_at?: string;
  job_title?: string;
  company_name?: string;
}

const STATUS_LABEL: Record<string, string> = {
  interested: "관심",
  applied: "지원함",
  phone_screen: "전화면접",
  take_home: "과제",
  onsite: "온사이트",
  offer: "오퍼",
  accepted: "수락",
  rejected: "거절",
};

export default function MyApplicationsPage() {
  const [items, setItems] = useState<AppItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/me/applications")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-display">내 지원 현황</h1>
      </div>

      {error && <p className="text-destructive text-body-sm">불러오기 실패: {error}</p>}

      {!items ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          아직 추적 중인 공고가 없어요. 공고 상세에서 추적을 시작하세요.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((a) => (
            <div key={a.job_id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.job_title ?? a.job_id}</p>
                  <p className="text-caption text-muted-foreground">{a.company_name}</p>
                </div>
                <Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge>
              </div>
              <div className="mt-2">
                <RecoveryPanel jobId={a.job_id} onRecovered={load} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
