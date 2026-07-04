"use client";

import { ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchRegionCities, type RegionCount } from "@/lib/api";
import { cn } from "@/lib/utils";

// 지역 선택 결과: region 파라미터 값(국가 key 또는 도시 key). label 은 버튼 표시용.
// 도시도 백엔드에서 별칭 regex 로 매핑되므로 국가와 동일하게 region 으로 보낸다.
export type RegionPick = { region: string; label: string } | null;

// 사람인식 2단 지역 선택 팝오버. 왼쪽=국가(건수), 오른쪽=선택한 국가의 도시(건수).
// 도시는 클릭 시 지연 로드하고 클라이언트 캐시. 둘 다 "현재 공고에 있는 지역"만(건수>0).
export function RegionPicker({
  countries,
  value,
  onChange,
}: {
  countries: RegionCount[];
  value: RegionPick;
  onChange: (pick: RegionPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(value?.region ?? null);
  const [cities, setCities] = useState<Record<string, RegionCount[]>>({});
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 활성 국가의 도시 지연 로드(캐시 미스만).
  useEffect(() => {
    if (!active || cities[active]) return;
    let cancelled = false;
    setLoading(true);
    fetchRegionCities(active)
      .then((cs) => {
        if (cancelled) return;
        setCities((m) => ({ ...m, [active]: cs }));
      })
      // 실패해도 로딩은 해제 — 없으면 "불러오는 중…"에 영구 고착된다.
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, cities]);

  const term = query.trim();
  const filtered = term
    ? countries.filter(
        (c) => c.label.includes(term) || c.value.includes(term.toLowerCase()),
      )
    : countries;
  const activeCountry = countries.find((c) => c.value === active) ?? null;
  const activeCities = active ? cities[active] : undefined;

  function close() {
    setOpen(false);
    setQuery("");
  }
  function pickCountry(c: RegionCount) {
    onChange({ region: c.value, label: c.label });
    close();
  }
  function pickCity(c: RegionCount, country: RegionCount) {
    onChange({ region: c.value, label: `${country.label} · ${c.label}` });
    close();
  }
  function reset() {
    onChange(null);
    setActive(null);
    close();
  }

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
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{value ? value.label : "지역 선택"}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-1 w-[min(92vw,33rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2.5">
            <div className="flex items-center gap-2 rounded-md border border-border px-2.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="지역명 입력"
                aria-label="지역명 입력"
                className="h-9 w-full bg-transparent text-body-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2">
            {/* 왼쪽: 국가 */}
            <ul className="max-h-[19rem] overflow-y-auto border-r border-border py-1">
              <li>
                <button
                  type="button"
                  onClick={reset}
                  className="flex w-full items-center px-3 py-1.5 text-body-sm text-muted-foreground hover:bg-accent"
                >
                  전체 지역
                </button>
              </li>
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-caption text-muted-foreground">결과 없음</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.value}>
                    <button
                      type="button"
                      onClick={() => setActive(c.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-body-sm hover:bg-accent",
                        active === c.value ? "bg-accent font-medium text-foreground" : "text-foreground",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {c.count.toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {/* 오른쪽: 선택한 국가의 도시 */}
            <div className="max-h-[19rem] overflow-y-auto py-1">
              {!activeCountry ? (
                <p className="px-4 py-4 text-caption text-muted-foreground">← 지역을 선택해주세요</p>
              ) : (
                <ul>
                  <li>
                    <button
                      type="button"
                      onClick={() => pickCountry(activeCountry)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-body-sm font-medium text-primary hover:bg-accent"
                    >
                      <span className="truncate">{activeCountry.label} 전체</span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {activeCountry.count.toLocaleString()}
                      </span>
                    </button>
                  </li>
                  {loading && !activeCities ? (
                    <li className="px-3 py-3 text-caption text-muted-foreground">불러오는 중…</li>
                  ) : activeCities && activeCities.length > 0 ? (
                    activeCities.map((ci) =>
                      ci.value ? (
                        <li key={ci.value}>
                          <button
                            type="button"
                            onClick={() => pickCity(ci, activeCountry)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-body-sm text-foreground hover:bg-accent"
                          >
                            <span className="truncate">{ci.label}</span>
                            <span className="shrink-0 text-caption text-muted-foreground">
                              {ci.count.toLocaleString()}
                            </span>
                          </button>
                        </li>
                      ) : (
                        // '그 외 지역' — 단일 필터로 정확히 못 잡아 비클릭(합계 표시용).
                        <li
                          key="__other__"
                          className="flex items-center justify-between gap-2 px-3 py-1.5 text-caption text-muted-foreground"
                        >
                          <span className="truncate">{ci.label}</span>
                          <span className="shrink-0">{ci.count.toLocaleString()}</span>
                        </li>
                      ),
                    )
                  ) : (
                    <li className="px-3 py-3 text-caption text-muted-foreground">
                      도시 구분이 없어요. ‘{activeCountry.label} 전체’로 검색하세요.
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
