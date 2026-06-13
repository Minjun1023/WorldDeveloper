"use client";

import { useSearchParams } from "next/navigation";

import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { useUpdateQuery } from "@/lib/use-update-query";

// 검색 좌측 facet 사이드바. 기존 쿼리 파라미터(region·visa·verified_only·discipline·
// remote·complete·include_unclear)를 그룹 체크박스로 제어(백엔드 변경 없음).
// 국가는 다중 선택(콤마 join), 직무는 단일 선택(체크박스 모양). 원격은 근무형태라 국가에서 제외.

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1.5">{children}</div>
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
      {count !== undefined && <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{count}</span>}
    </label>
  );
}

export function FilterSidebar({ regions }: { regions: RegionCount[] }) {
  const sp = useSearchParams();
  const update = useUpdateQuery();

  const countries = regions.filter((r) => r.value !== "remote" && r.count > 0);
  const selectedRegions = new Set((sp.get("region") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const toggleRegion = (key: string) => {
    const next = new Set(selectedRegions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const csv = countries.filter((c) => next.has(c.value)).map((c) => c.value).join(",");
    update({ region: csv || null });
  };

  const visa = sp.get("visa");
  const verifiedOnly = sp.get("verified_only") === "true";
  const includeUnclear = sp.get("include_unclear") === "true";
  const discipline = sp.get("discipline");
  const remote = sp.get("remote") === "true";
  const complete = sp.get("complete") === "true";

  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-4">
      {countries.length > 0 && (
        <Group title="국가">
          {countries.map((c) => (
            <CheckRow
              key={c.value}
              checked={selectedRegions.has(c.value)}
              onToggle={() => toggleRegion(c.value)}
              label={c.label}
              count={c.count}
            />
          ))}
        </Group>
      )}

      <Group title="비자">
        <CheckRow
          checked={visa === "sponsors"}
          onToggle={() => update({ visa: visa === "sponsors" ? null : "sponsors" })}
          label="스폰서십 명시"
        />
        <CheckRow
          checked={verifiedOnly}
          onToggle={() => update({ verified_only: verifiedOnly ? null : "true" })}
          label="정부 명부 검증"
        />
      </Group>

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
        <CheckRow checked={remote} onToggle={() => update({ remote: remote ? null : "true" })} label="원격 가능" />
        <CheckRow checked={complete} onToggle={() => update({ complete: complete ? null : "true" })} label="정보 충실만" />
        <CheckRow
          checked={includeUnclear}
          onToggle={() => update({ include_unclear: includeUnclear ? null : "true" })}
          label="정보 없는 공고 포함"
        />
      </Group>
    </aside>
  );
}
