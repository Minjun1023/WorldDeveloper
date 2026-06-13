"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RegionCount } from "@/lib/api";
import { cn } from "@/lib/utils";

// 지역 다중 선택(체크박스). 여러 국가를 고른 뒤 한 번에 적용(콤마 join 한 region 값).
// 토글마다 navigate 하지 않고 로컬 선택 → 닫힐 때/‘적용’ 시 1회만 onChange(결과 재조회 최소화).
// 원격은 근무형태지 국가가 아니므로 제외(CountryTiles 와 동일 원칙). 공고 0건 지역도 제외.
const parse = (v: string | null) => new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export function RegionMultiSelect({
  regions,
  value,
  onChange,
}: {
  regions: RegionCount[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Set<string>>(() => parse(value));
  const ref = useRef<HTMLDivElement>(null);

  const options = regions.filter((r) => r.value !== "remote" && r.count > 0);
  const toCsv = (set: Set<string>) => options.filter((o) => set.has(o.value)).map((o) => o.value).join(",");

  // 외부에서 region 이 바뀌면(초기화·뒤로가기 등) 로컬 동기화.
  useEffect(() => {
    setLocal(parse(value));
  }, [value]);

  const commit = (set: Set<string>) => {
    const next = toCsv(set) || null;
    const cur = toCsv(parse(value)) || null;
    if (next !== cur) onChange(next);
  };

  // 바깥 클릭 시 닫고 적용. 최신 local 을 ref 로 읽어 effect 의존성은 open 만 유지.
  const localRef = useRef(local);
  localRef.current = local;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        commitRef.current(localRef.current);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (key: string) =>
    setLocal((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const apply = () => {
    setOpen(false);
    commit(local);
  };

  const chosen = options.filter((o) => local.has(o.value));
  const label =
    chosen.length === 0
      ? "전체 지역"
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen[0].label} 외 ${chosen.length - 1}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? apply() : setOpen(true))}
        aria-expanded={open}
        aria-label="지역 선택"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-body-sm",
          chosen.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[14rem] rounded-md border border-border bg-surface shadow-md">
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => setLocal(new Set())}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-body-sm hover:bg-accent",
                chosen.length === 0 && "font-medium text-primary",
              )}
            >
              전체 지역
            </button>
            {options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-body-sm hover:bg-accent"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={local.has(o.value)}
                    onChange={() => toggle(o.value)}
                    aria-label={o.label}
                    className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  />
                  <span className="truncate text-foreground">{o.label}</span>
                </span>
                <span className="text-caption text-muted-foreground">{o.count}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-border p-2">
            <Button type="button" size="sm" className="w-full" onClick={apply}>
              적용{chosen.length > 0 ? ` (${chosen.length})` : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
