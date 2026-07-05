"use client";

import { ChevronDown, ChevronUp, PanelLeftClose, RotateCcw, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { useUpdateQuery } from "@/lib/use-update-query";

// 검색 좌측 facet 사이드바. 기존 쿼리 파라미터(region·visa·verified_only·discipline·
// remote·include_unclear)를 그룹 체크박스로 제어(백엔드 변경 없음).
// 국가는 다중 선택(콤마 join), 직무는 단일 선택(체크박스 모양). 원격은 근무형태라 국가에서 제외.

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-foreground">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  count,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-body-sm">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={label}
          className="h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        <span className="truncate text-foreground">{label}</span>
      </span>
      {count !== undefined && <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{count.toLocaleString()}</span>}
    </label>
  );
}

export function FilterSidebar({
  regions,
  onCollapse,
  plain = false,
}: {
  regions: RegionCount[];
  onCollapse?: () => void;
  /** 바텀시트 등 자체 chrome 이 있는 컨테이너 안에서 테두리·"필터" 헤더를 생략. */
  plain?: boolean;
}) {
  const sp = useSearchParams();
  const update = useUpdateQuery();
  // 국가 목록은 50+개라 상위 10개만 기본 노출, 나머지는 "더보기"로 접는다.
  const [showAllCountries, setShowAllCountries] = useState(false);

  const countries = regions.filter((r) => r.value !== "remote" && r.count > 0);
  const countryValues = new Set(countries.map((c) => c.value));
  const selectedRegions = new Set((sp.get("region") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  // rc: 도시를 골랐을 때의 부모 국가(통합검색 모달이 전달). 도시 검색은 그대로 두고 국가 체크만 추가 표시.
  const regionCountry = sp.get("rc");
  // 국가 체크박스에 없는 활성 지역(도시 등) — 통합검색 모달에서 도시를 고르면 여기에 들어온다.
  const cityRegions = [...selectedRegions].filter((v) => !countryValues.has(v));
  const prettyRegion = (v: string) =>
    v.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  // 국가/도시 값을 모두 보존하며 토글(기존엔 국가만 남겨 도시가 사라졌다).
  const toggleRegion = (key: string) => {
    // 도시 선택 때문에 rc 로 체크된 국가를 끄면 → 도시 region + rc 모두 해제
    if (regionCountry === key && !selectedRegions.has(key)) {
      update({ region: null, rc: null });
      return;
    }
    const next = new Set(selectedRegions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update({ region: [...next].join(",") || null });
  };
  const removeRegion = (key: string) => {
    const next = new Set(selectedRegions);
    next.delete(key);
    // 부모 국가가 있으면 도시 대신 국가 전체로 남겨 국가 체크는 유지.
    if (regionCountry) next.add(regionCountry);
    update({ region: [...next].join(",") || null, rc: null });
  };

  const discipline = sp.get("discipline");
  const remote = sp.get("remote") === "true";

  // 모든 필터를 비워 기본 목록으로 되돌린다(선택이 없어도 무해). 버튼은 항상 노출.
  const reset = () => update({ region: null, discipline: null, remote: null, rc: null });

  return (
    <aside
      className={
        plain
          ? "h-fit"
          : "h-fit rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-4"
      }
    >
      <div
        className={
          plain
            ? "mb-3 flex items-center justify-end gap-2"
            : "mb-3 flex items-center justify-between gap-2 border-b border-border pb-3"
        }
      >
        {!plain && (
          <div className="flex items-center gap-1">
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                aria-label="필터 접기"
                title="필터 접기"
                className="inline-flex items-center justify-center rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <span className="text-body-sm font-bold text-foreground">필터</span>
          </div>
        )}
        <button
          type="button"
          onClick={reset}
          aria-label="필터 갱신"
          title="필터 갱신"
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary/5"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          갱신
        </button>
      </div>
      {countries.length > 0 && (
        <Group title="국가">
          {/* 통합검색에서 고른 상세 지역(도시 등) — 국가 체크박스엔 없으므로 칩으로 표시·제거 */}
          {cityRegions.length > 0 && (
            <div className="-mt-0.5 mb-1 flex flex-wrap gap-1.5">
              {cityRegions.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => removeRegion(v)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-caption font-semibold text-primary transition-colors hover:opacity-80"
                  aria-label={`${prettyRegion(v)} 지역 필터 제거`}
                >
                  {prettyRegion(v)}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          {countries
            // 접힌 상태에서도 선택된 국가는 항상 보이게(상위 10 밖이어도 유지).
            .filter(
              (c, i) =>
                showAllCountries ||
                i < 10 ||
                selectedRegions.has(c.value) ||
                regionCountry === c.value,
            )
            .map((c) => (
              <CheckRow
                key={c.value}
                checked={selectedRegions.has(c.value) || regionCountry === c.value}
                onToggle={() => toggleRegion(c.value)}
                label={c.label}
                count={c.count}
              />
            ))}
          {countries.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllCountries((v) => !v)}
              className="inline-flex items-center gap-1 text-body-sm font-medium text-primary transition-colors hover:underline"
            >
              {showAllCountries ? (
                <>
                  접기 <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              ) : (
                <>
                  더보기 ({(countries.length - 10).toLocaleString()})
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </Group>
      )}

      <Group title="직무">
        {DISCIPLINES.map((d) => (
          <CheckRow
            key={d.value}
            checked={discipline === d.value}
            onToggle={() => update({ discipline: discipline === d.value ? null : d.value })}
            label={d.label}
          />
        ))}
      </Group>

      <Group title="기타">
        {/* "지역 제한 원격"(예: US 거주자만)은 제외되는 필터 — 라벨로 기준을 드러낸다. */}
        <CheckRow checked={remote} onToggle={() => update({ remote: remote ? null : "true" })} label="원격 (한국에서 근무 가능)" />
      </Group>
    </aside>
  );
}
