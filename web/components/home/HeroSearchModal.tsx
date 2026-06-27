"use client";

import { Briefcase, ChevronDown, MapPin, RotateCcw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchRegionCities, type RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { cn } from "@/lib/utils";

type Disc = { value: string; label: string };

// 사람인식 통합 검색 모달 — 검색어 + 지역(국가→도시 2단) + 직무(공고 수 표시). 검색 시 /search 로 이동.
// anchorRect: 기존 검색 바 좌표. 그 위치에 겹쳐 뜬다(없으면 상단 중앙 fallback).
export function HeroSearchModal({
  regions,
  onClose,
  anchorRect = null,
  initialQuery = "",
}: {
  regions: RegionCount[];
  onClose: () => void;
  anchorRect?: DOMRect | null;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [region, setRegion] = useState<RegionCount | null>(null);
  // 도시를 고른 경우 그 부모 국가 값(필터에서 국가 체크 표시용 rc 힌트).
  const [regionCountry, setRegionCountry] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<Disc | null>(null);
  const [panel, setPanel] = useState<"region" | "discipline" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 포커스 트랩/복귀용: 모달 패널 + 열기 직전 포커스된 요소(트리거).
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // 지역: 활성 국가 + 도시 캐시(지연 로드)
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [cities, setCities] = useState<Record<string, RegionCount[]>>({});
  const [citiesLoading, setCitiesLoading] = useState(false);
  // 직무별 공고 수(지연 로드)
  const [discCounts, setDiscCounts] = useState<Record<string, number | null> | null>(null);

  // 원격은 근무형태라 지역에서 제외. 공고 있는 국가만.
  const countries = regions.filter((r) => r.value !== "remote" && r.count > 0);

  useEffect(() => {
    // 열기 직전 포커스(트리거)를 기억했다가 닫을 때 되돌린다.
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // 포커스 트랩 — Tab 이 모달 밖 배경 요소로 새지 않도록 패널 내부에서 순환.
      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // 트리거로 포커스 복귀(요소가 아직 살아 있으면).
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  // 활성 국가의 도시 지연 로드(캐시 미스만)
  useEffect(() => {
    if (!activeCountry || cities[activeCountry]) return;
    let cancelled = false;
    setCitiesLoading(true);
    fetchRegionCities(activeCountry).then((cs) => {
      if (cancelled) return;
      setCities((m) => ({ ...m, [activeCountry]: cs }));
      setCitiesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCountry, cities]);

  // 직무 패널 첫 오픈 시 공고 수 로드
  useEffect(() => {
    if (panel !== "discipline" || discCounts) return;
    let cancelled = false;
    fetch("/api/jobs/discipline-counts")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (!cancelled) setDiscCounts(d as Record<string, number | null>);
      })
      .catch(() => {
        if (!cancelled) setDiscCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [panel, discCounts]);

  function submit() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (region) params.set("region", region.value);
    // 도시 선택 시 부모 국가 힌트 — 검색은 도시로, 필터에선 국가도 체크되도록.
    if (regionCountry && regionCountry !== region?.value) params.set("rc", regionCountry);
    if (discipline) params.set("discipline", discipline.value);
    const qs = params.toString();
    onClose();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  const activeCountryObj = countries.find((c) => c.value === activeCountry) ?? null;
  const activeCities = activeCountry ? cities[activeCountry] : undefined;

  // 기존 검색 바 좌표에 정확히 겹치도록 고정 배치(우측 오버플로는 뷰포트 안으로 클램프).
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const panelW = Math.min(880, vw - 24);
  const panelStyle: React.CSSProperties = anchorRect
    ? {
        position: "fixed",
        top: Math.max(12, anchorRect.top),
        left: Math.max(12, Math.min(anchorRect.left, vw - panelW - 12)),
        width: panelW,
      }
    : { position: "fixed", top: 88, left: "50%", transform: "translateX(-50%)", width: panelW };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="공고 통합 검색"
    >
      <div
        ref={panelRef}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
        style={panelStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 검색 바 */}
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-stretch">
          <div className="flex flex-1 items-center gap-2 rounded-lg border-2 border-transparent bg-surface-2 px-4 transition-colors focus-within:border-primary focus-within:bg-surface">
            <Search className="h-5 w-5 shrink-0 text-hint" aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="검색어를 입력하세요"
              aria-label="검색어"
              className="h-12 w-full bg-transparent text-body text-foreground placeholder:text-hint focus:outline-none"
            />
          </div>

          <FieldButton
            icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
            label={region ? region.label : "지역을 선택해주세요"}
            selected={!!region}
            open={panel === "region"}
            onClick={() => setPanel((p) => (p === "region" ? null : "region"))}
          />
          <FieldButton
            icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}
            label={discipline ? discipline.label : "직무를 선택해주세요"}
            selected={!!discipline}
            open={panel === "discipline"}
            onClick={() => setPanel((p) => (p === "discipline" ? null : "discipline"))}
          />

          <Button
            type="button"
            size="lg"
            onClick={submit}
            className="shrink-0 justify-center text-white sm:w-28"
          >
            검색
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground sm:inline-flex"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* 지역(국가 → 도시 2단) */}
        {panel === "region" && (
          <div className="border-t border-border">
            <PanelHeader
              title="지역(국가) 선택"
              onClear={() => {
                setRegion(null);
                setRegionCountry(null);
                setActiveCountry(null);
              }}
            />
            <div className="grid grid-cols-2">
              {/* 국가 리스트 */}
              <ul className="max-h-72 overflow-y-auto border-r border-border p-2">
                {countries.map((c) => (
                  <li key={c.value}>
                    <Row
                      label={c.label}
                      meta={c.count}
                      selected={activeCountry === c.value}
                      onClick={() => setActiveCountry(c.value)}
                    />
                  </li>
                ))}
              </ul>
              {/* 선택한 국가의 도시 */}
              <ul className="max-h-72 overflow-y-auto p-2">
                {!activeCountryObj ? (
                  <li className="px-3 py-4 text-caption text-muted-foreground">
                    ← 국가를 선택하면 상세 지역이 표시됩니다.
                  </li>
                ) : (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setRegion(activeCountryObj);
                          setRegionCountry(null);
                          setPanel(null);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-body-sm font-semibold text-primary transition-colors hover:bg-primary-tint"
                      >
                        <span className="truncate">{activeCountryObj.label} 전체</span>
                        <span className="shrink-0 text-caption">{activeCountryObj.count.toLocaleString()}</span>
                      </button>
                    </li>
                    {citiesLoading && !activeCities ? (
                      <li className="px-3 py-3 text-caption text-muted-foreground">불러오는 중…</li>
                    ) : activeCities && activeCities.length > 0 ? (
                      activeCities.map((ci) =>
                        ci.value ? (
                          <li key={ci.value}>
                            <Row
                              label={ci.label}
                              meta={ci.count}
                              selected={region?.value === ci.value}
                              onClick={() => {
                                setRegion({
                                  value: ci.value,
                                  label: `${activeCountryObj.label} · ${ci.label}`,
                                  count: ci.count,
                                });
                                setRegionCountry(activeCountryObj.value);
                                setPanel(null);
                              }}
                            />
                          </li>
                        ) : (
                          <li
                            key="__other__"
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-caption text-muted-foreground"
                          >
                            <span className="truncate">{ci.label}</span>
                            <span className="shrink-0">{ci.count.toLocaleString()}</span>
                          </li>
                        ),
                      )
                    ) : (
                      <li className="px-3 py-3 text-caption text-muted-foreground">
                        상세 지역이 없어요. ‘{activeCountryObj.label} 전체’로 검색하세요.
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* 직무(공고 수 표시) */}
        {panel === "discipline" && (
          <div className="border-t border-border">
            <PanelHeader title="직무 선택" onClear={() => setDiscipline(null)} />
            <ul className="max-h-72 overflow-y-auto p-2">
              {DISCIPLINES.map((d) => {
                const cnt = discCounts ? discCounts[d.value] : undefined;
                return (
                  <li key={d.value}>
                    <Row
                      label={d.label}
                      meta={typeof cnt === "number" ? cnt : null}
                      selected={discipline?.value === d.value}
                      onClick={() => {
                        setDiscipline({ value: d.value, label: d.label });
                        setPanel(null);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldButton({
  icon,
  label,
  selected,
  open,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "flex h-12 items-center justify-between gap-2 rounded-lg border-2 px-4 text-body transition-colors sm:w-52",
        open ? "border-primary bg-surface" : "border-transparent bg-surface-2 hover:bg-accent",
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-2", selected ? "text-foreground" : "text-hint")}>
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate font-medium">{label}</span>
      </span>
      <ChevronDown
        className={cn("h-4 w-4 shrink-0 text-hint transition-transform", open && "rotate-180")}
        aria-hidden="true"
      />
    </button>
  );
}

function PanelHeader({ title, onClear }: { title: string; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-3">
      <span className="text-body-sm font-bold text-foreground">{title}</span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" aria-hidden="true" />
        선택 초기화
      </button>
    </div>
  );
}

function Row({
  label,
  meta,
  selected,
  onClick,
}: {
  label: string;
  meta?: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-body-sm transition-colors",
        selected ? "bg-primary-tint font-semibold text-primary" : "text-foreground hover:bg-surface-2",
      )}
    >
      <span className="truncate">{label}</span>
      {typeof meta === "number" && (
        <span className="shrink-0 text-caption text-hint">{meta.toLocaleString()}</span>
      )}
    </button>
  );
}
