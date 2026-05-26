# 홈 풀구성 검색바 구현 계획

> superpowers:subagent-driven-development. 프론트 전용, 백엔드 무변경.

**Goal:** 홈(`/`) 히어로의 키워드-only 검색박을 `/search`처럼 **키워드 + 지역 + 직무 + 검색** 풀구성으로. 셀렉터는 로컬 상태로 담고 **검색 버튼**에서 `/search?q=&region=&discipline=` 로 이동(홈에서 조합→검색).

**설계 결정(사용자 승인):** 홈 셀렉터는 즉시 이동 X, 검색 시 한 번에 /search로. 홈 페이지가 `fetchRegions()`로 지역 건수 받아 전달. 직무 목록은 공용 모듈로 추출(DRY). 백엔드/`/search` 동작 무변경.

**관련:** `/search` SearchBar(키워드+지역+직무), `Dropdown` UI, `fetchRegions`/`RegionCount`/`JobQuery.region|discipline`(api.ts) 이미 존재.

---

## Task 1: DISCIPLINES 공용 모듈
**Create:** `web/lib/disciplines.ts`
```ts
import type { DropdownOption } from "@/components/ui/dropdown";

export const DISCIPLINES: DropdownOption[] = [
  { value: "backend", label: "백엔드" },
  { value: "frontend", label: "프론트엔드" },
  { value: "fullstack", label: "풀스택" },
  { value: "mobile", label: "모바일" },
  { value: "data-ml", label: "데이터·ML" },
  { value: "devops", label: "DevOps·인프라" },
];
```
**Modify:** `web/components/search/SearchBar.tsx` — inline `DISCIPLINES` 상수 제거하고 `import { DISCIPLINES } from "@/lib/disciplines";`. (사용처 동일.)
- [ ] typecheck

## Task 2: HeroSearch 풀구성
**Modify (전체 교체):** `web/components/home/HeroSearch.tsx`
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";

export function HeroSearch({ regions }: { regions: RegionCount[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<string | null>(null);

  const regionOptions: DropdownOption[] = regions.map((r) => ({
    value: r.value,
    label: r.label,
    count: r.count,
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const kw = q.trim();
    if (kw) params.set("q", kw);
    if (region) params.set("region", region);
    if (discipline) params.set("discipline", discipline);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="python backend berlin, react senior ..."
        aria-label="공고 검색"
        className="font-mono sm:flex-1"
      />
      <div className="sm:w-40">
        <Dropdown placeholder="지역 선택" options={regionOptions} value={region} onSelect={setRegion} />
      </div>
      <div className="sm:w-40">
        <Dropdown placeholder="직무 선택" options={DISCIPLINES} value={discipline} onSelect={setDiscipline} />
      </div>
      <Button type="submit">검색</Button>
    </form>
  );
}
```
- [ ] typecheck

## Task 3: Hero + 홈 page 배선
**Modify:** `web/components/home/Hero.tsx` — `regions` prop 받아 HeroSearch 에 전달:
```tsx
import Link from "next/link";

import { HeroSearch } from "@/components/home/HeroSearch";
import type { RegionCount } from "@/lib/api";

const CHIPS: { label: string; href: string }[] = [
  { label: "비자 스폰서", href: "/search?visa=sponsors" },
  { label: "원격 가능", href: "/search?remote=true" },
];

export function Hero({ regions }: { regions: RegionCount[] }) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <h1 className="text-display">
        EU <span className="text-primary">비자 스폰서</span> 공고, 한 곳에서.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        한국 개발자의 유럽 진출 — 비자 스폰서십 명시 공고 + 6차원 맞춤 추천.
      </p>
      <div className="mt-6">
        <HeroSearch regions={regions} />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-caption text-muted-foreground hover:text-foreground"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
```
**Modify:** `web/app/page.tsx` — `fetchRegions` import 추가, Promise.all 에 추가, `<Hero regions={regions} />`:
```tsx
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";
// ...
  const [visaRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 6 }),
    fetchCompanies(),
    fetchRegions(),
  ]);
// ...
      <Hero regions={regions} />
```
- [ ] `cd web && npm run typecheck && npm run build` 성공.
- [ ] 커밋:
```bash
git add web/lib/disciplines.ts web/components/search/SearchBar.tsx web/components/home/HeroSearch.tsx web/components/home/Hero.tsx web/app/page.tsx
git commit -m "feat(web-home): 홈 히어로 검색바 풀구성(키워드+지역+직무) → /search 이동"
```

## Task 4: 라이브 검증
- [ ] 워크트리 스택(격리 DB 시드) → 홈 `/`: 히어로에 키워드+지역▼(건수)+직무▼+검색. 지역/직무 선택+키워드 입력 후 검색 → `/search?q=&region=&discipline=` 이동 + 필터 결과. /search 기존 동작 무변경.

## Self-Review
- 홈 검색박 풀구성 ✓. 셀렉터 로컬상태→검색 시 /search 이동(useUpdateQuery 아님, router.push) ✓. DISCIPLINES 공용화(DRY) ✓. regions 서버 fetch→Hero→HeroSearch ✓. 백엔드/`/search` 무변경.
- 타입: `setRegion`(Dispatch<SetStateAction<string|null>>) ↔ Dropdown onSelect((string|null)=>void) 호환. RegionCount/DISCIPLINES 타입 일관.
