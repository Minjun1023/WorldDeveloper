"use client";

import { ArrowRight, Bell, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Params = Record<string, string | boolean | null | undefined>;
type SavedSearch = { id: string; label: string; params: Params; newCount: number; lastSeenAt: string };

// 저장된 params 키는 백엔드(SavedSearchParams)용 camelCase. /search URL 파라미터는 snake_case 라
// 라운드트립 시 키를 변환해야 한다(현재 includeUnclear → include_unclear 만 상이).
const URL_KEY: Record<string, string> = { includeUnclear: "include_unclear" };

function toQuery(params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === false || v === "") continue;
    sp.set(URL_KEY[k] ?? k, String(v));
  }
  const s = sp.toString();
  return s ? `/search?${s}` : "/search";
}

export default function SavedSearchesPage() {
  const [items, setItems] = useState<SavedSearch[] | null>(null);

  useEffect(() => {
    fetch("/api/me/searches").then((r) => (r.ok ? r.json() : [])).then(setItems).catch(() => setItems([]));
  }, []);

  async function remove(id: string) {
    setItems((xs) => (xs ?? []).filter((x) => x.id !== id));
    try { await fetch(`/api/me/searches/${id}`, { method: "DELETE" }); } catch { /* 무시 */ }
  }
  function open(s: SavedSearch) {
    fetch(`/api/me/searches/${s.id}/seen`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-display">저장 검색</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">
          저장한 검색 조건에 맞는 새 공고가 들어오면 여기 표시돼요. (이메일 알림은 추후 제공)
        </p>
      </div>

      {items === null ? (
        <p className="text-body-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <Bell className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-body-sm text-muted-foreground">아직 저장한 검색이 없어요.</p>
          <Link href="/search" className="mt-3 inline-block text-body-sm font-medium text-primary hover:underline">
            검색하러 가기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
              <Link href={toQuery(s.params)} onClick={() => open(s)} className="group min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold group-hover:text-primary">{s.label}</span>
                  {s.newCount > 0 && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold text-primary"
                      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
                      새 공고 {s.newCount}건
                    </span>
                  )}
                </div>
                <span className="mt-1 inline-flex items-center gap-1 text-caption text-muted-foreground">
                  검색 결과 보기 <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </Link>
              <button type="button" onClick={() => remove(s.id)} aria-label="삭제"
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
