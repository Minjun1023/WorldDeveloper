"use client";

import { useEffect, useState } from "react";

import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

// 백엔드 JobService.REGIONS 키와 일치. 'remote'=원격.
const REGIONS: { key: string; label: string }[] = [
  { key: "", label: "전체 지역" },
  { key: "us", label: "미국" },
  { key: "japan", label: "일본" },
  { key: "germany", label: "독일" },
  { key: "uk", label: "영국" },
  { key: "netherlands", label: "네덜란드" },
  { key: "ireland", label: "아일랜드" },
  { key: "canada", label: "캐나다" },
  { key: "france", label: "프랑스" },
  { key: "spain", label: "스페인" },
  { key: "poland", label: "폴란드" },
  { key: "portugal", label: "포르투갈" },
  { key: "sweden", label: "스웨덴" },
  { key: "denmark", label: "덴마크" },
  { key: "italy", label: "이탈리아" },
  { key: "austria", label: "오스트리아" },
  { key: "czech", label: "체코" },
  { key: "switzerland", label: "스위스" },
  { key: "remote", label: "원격" },
];

// 백엔드 JobFunction 키와 일치.
const FUNCTIONS: { key: string; label: string }[] = [
  { key: "", label: "전체 직무" },
  { key: "backend", label: "백엔드" },
  { key: "frontend", label: "프론트엔드" },
  { key: "fullstack", label: "풀스택" },
  { key: "mobile", label: "모바일" },
  { key: "data_ml", label: "데이터·ML" },
  { key: "devops", label: "DevOps·인프라" },
];

type PopularItem = { job: Job; view_count: number };

const selectCls =
  "h-9 rounded-lg border border-border bg-background px-3 text-body-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PopularJobs() {
  const [region, setRegion] = useState("");
  const [fn, setFn] = useState("");
  const [items, setItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const p = new URLSearchParams({ limit: "6" });
    if (region) p.set("region", region);
    if (fn) p.set("function", fn);
    fetch(`/api/jobs/popular?${p.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: unknown) => setItems(Array.isArray(d) ? (d as PopularItem[]) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [region, fn]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls} aria-label="지역 선택">
          {REGIONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <select value={fn} onChange={(e) => setFn(e.target.value)} className={selectCls} aria-label="직무 선택">
          {FUNCTIONS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">조건에 맞는 공고가 아직 없어요.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <JobCard key={it.job.id} job={it.job} />
          ))}
        </div>
      )}
    </div>
  );
}
