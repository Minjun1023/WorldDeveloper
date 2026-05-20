"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const { data: session, status } = useSession();
  const [items, setItems] = useState<AppItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me/applications")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(e.message));
  }, [status]);

  if (status === "loading") {
    return <p className="text-muted-foreground">불러오는 중…</p>;
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-4">
        <h1 className="text-display">내 지원 현황</h1>
        <p className="text-muted-foreground">지원 추적은 로그인이 필요해요.</p>
        <div className="flex gap-2">
          <Button onClick={() => signIn("github")}>GitHub 로그인</Button>
          <Button variant="secondary" onClick={() => signIn("google")}>Google 로그인</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-display">내 지원 현황</h1>
        <span className="text-body-sm text-muted-foreground">{session.user?.email}</span>
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
            <div key={a.job_id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.job_title ?? a.job_id}</p>
                <p className="text-caption text-muted-foreground">{a.company_name}</p>
              </div>
              <Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
