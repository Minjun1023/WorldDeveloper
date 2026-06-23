"use client";

import { ChevronDown } from "lucide-react";
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
  // '원격'은 지역이 아니라 근무 형태라 지역 드롭다운에서 제외(원격 공고는 location 매칭으로 각 국가에 노출).
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

// 커스텀 드롭다운: 네이티브 OS 화살표 숨기고(appearance-none) chevron 을 직접 얹는다.
function Dropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  ariaLabel: string;
}) {
  const active = value !== "";
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`h-10 cursor-pointer appearance-none rounded-full border bg-surface py-0 pl-4 pr-9 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active
            ? "border-primary text-primary"
            : "border-border text-foreground hover:border-primary/40 hover:bg-accent"
        }`}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

export function PopularJobs({ loggedIn = false }: { loggedIn?: boolean }) {
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
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Dropdown value={region} onChange={setRegion} options={REGIONS} ariaLabel="지역 선택" />
        <Dropdown value={fn} onChange={setFn} options={FUNCTIONS} ariaLabel="직무 선택" />
      </div>

      {loading ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">조건에 맞는 공고가 아직 없어요.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <JobCard key={it.job.id} job={it.job} showSave loggedIn={loggedIn} />
          ))}
        </div>
      )}
    </div>
  );
}
