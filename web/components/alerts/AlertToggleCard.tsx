"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 이메일 알림 on/off 토글 카드 — 유저당 1개 전역 설정을 갖는 알림들의 공용 UI.
 * endpoint 는 GET { notify } / PUT { enabled } 계약을 따르는 BFF 라우트
 * (/api/me/company-alerts, /api/me/saved-job-alerts, /api/me/match-alerts).
 */
export function AlertToggleCard({
  endpoint,
  title,
  description,
  defaultOn = true,
}: {
  endpoint: string;
  title: string;
  description: string;
  // 조회 실패/행 미생성 시 낙관 표시값 — 옵트인 알림(match)은 false 로.
  defaultOn?: boolean;
}) {
  const [notify, setNotify] = useState<boolean | null>(null); // null = 로딩
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setNotify(typeof d?.notify === "boolean" ? d.notify : defaultOn))
      .catch(() => alive && setNotify(defaultOn));
    return () => {
      alive = false;
    };
  }, [endpoint, defaultOn]);

  async function toggle() {
    if (pending || notify === null) return;
    setPending(true);
    const next = !notify;
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setNotify(next);
    } finally {
      setPending(false);
    }
  }

  const on = notify === true;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending || notify === null}
        aria-pressed={on}
        className={
          on
            ? "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-tint px-3 py-2 text-body-sm font-medium text-primary transition-colors hover:opacity-80 disabled:opacity-50"
            : "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-body-sm font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        }
      >
        {on ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
        {notify === null ? "…" : on ? "알림 켜짐" : "알림 꺼짐"}
      </button>
    </div>
  );
}
