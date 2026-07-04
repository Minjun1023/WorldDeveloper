"use client";

import { Briefcase, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DISCIPLINES } from "@/lib/disciplines";
import { cn } from "@/lib/utils";

export type DisciplinePick = { value: string; label: string } | null;

// 직무 선택 팝오버(앵커형 드롭다운). 트리거 바로 아래에 위치. 9개 직무 + 기타, 공고 수 표시.
// counts 는 현재 선택된 지역(region)으로 스코프해 지연 로드한다(지역별 직무 분포).
export function DisciplinePicker({
  value,
  onChange,
  region,
}: {
  value: DisciplinePick;
  onChange: (pick: DisciplinePick) => void;
  region: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | null> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 열릴 때(또는 지역 변경 시) 직무별 공고 수 로드 — 선택 지역으로 스코프.
  const [countsFailed, setCountsFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCounts(null);
    setCountsFailed(false);
    const p = new URLSearchParams();
    if (region) p.set("region", region);
    fetch(`/api/jobs/discipline-counts?${p.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled) setCounts(d as Record<string, number | null>);
      })
      // 실패 시 "—" 표시(countsFailed). {} 로 채우면 전 직무가 '0개'로 보여
      // "공고가 없다"는 거짓 신호가 된다 — 실패와 0 을 구분한다.
      .catch(() => {
        if (!cancelled) setCountsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, region]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-body-sm",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{value ? value.label : "직무 선택"}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-1 w-[min(92vw,20rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <ul className="max-h-[20rem] overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-body-sm text-muted-foreground hover:bg-accent"
              >
                전체 직무
              </button>
            </li>
            {DISCIPLINES.map((d) => (
              <li key={d.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ value: d.value, label: d.label });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-body-sm hover:bg-accent",
                    value?.value === d.value
                      ? "bg-accent font-medium text-foreground"
                      : "text-foreground",
                  )}
                >
                  <span className="truncate">{d.label}</span>
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {counts ? (counts[d.value] ?? 0).toLocaleString() : countsFailed ? "—" : "…"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
