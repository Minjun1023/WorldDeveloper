"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { DisciplinePicker, type DisciplinePick } from "@/components/home/DisciplinePicker";
import { RegionPicker, type RegionPick } from "@/components/home/RegionPicker";
import { JobCard } from "@/components/job/JobCard";
import { LoadError } from "@/components/ui/LoadError";
import type { RegionCount } from "@/lib/api";
import type { Job } from "@/lib/types";

type PopularItem = { job: Job; view_count: number };

export function PopularJobs({
  loggedIn = false,
  regions = [],
}: {
  loggedIn?: boolean;
  regions?: RegionCount[];
}) {
  // 지역·직무는 각각 별도 앵커형 드롭다운(트리거 위치에 맞춰 열림). 데이터 파생 지역 + 9개 직무+기타.
  const countries = regions.filter((r) => r.value !== "remote" && r.count > 0);
  const [region, setRegion] = useState<RegionPick>(null);
  const [discipline, setDiscipline] = useState<DisciplinePick>(null);
  const [items, setItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // 실패를 "공고 없음"으로 위장하지 않기 위한 구분
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    const p = new URLSearchParams({ limit: "6" });
    if (region) p.set("region", region.region);
    if (discipline) p.set("discipline", discipline.value);
    fetch(`/api/jobs/popular?${p.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: unknown) => setItems(Array.isArray(d) ? (d as PopularItem[]) : []))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [region, discipline, reloadKey]);

  const hasFilter = !!region || !!discipline;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="w-56 max-w-full">
          <RegionPicker countries={countries} value={region} onChange={setRegion} />
        </div>
        <div className="w-52 max-w-full">
          <DisciplinePicker
            value={discipline}
            onChange={setDiscipline}
            region={region?.region ?? null}
          />
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setRegion(null);
              setDiscipline(null);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> 초기화
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <div className="py-6">
          <LoadError message="인기 공고를 불러오지 못했어요" onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">조건에 맞는 공고가 아직 없어요.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <JobCard key={it.job.id} job={it.job} showSave loggedIn={loggedIn} />
          ))}
        </div>
      )}
    </div>
  );
}
