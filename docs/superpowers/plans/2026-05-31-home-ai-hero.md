# 홈 AI 추천 중심 대화형 히어로 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈(/) 히어로를 자연어 AI 추천 중심(대화형)으로 재구성 — 큰 NL 프롬프트 + 프리셋 칩 + 실데이터 신뢰 수치 띠, 중복 "나에게 맞는 공고" 섹션 제거, 구조화 검색은 보조 링크화.

**Architecture:** 웹 전용. `NlRecommend`에 프리셋 칩 추가(기존 추천 로직 재사용), `HeroStats` 신규, `Hero` 재작성, `page.tsx`에서 stats 집계 후 주입. 백엔드 무변경.

**Tech Stack:** Next.js 14 App Router / React / TS / Tailwind. 검증: `npx tsc --noEmit` + 라이브 비주얼(웹 테스트 러너 없음, 기존 관행).

설계 전문: `docs/superpowers/specs/2026-05-31-home-ai-hero-design.md`.

> 명령은 `web/`에서. `Job`/`RecommendResponse` 등 타입 기존 사용. 작업 순서: NlRecommend → HeroStats → Hero → page.tsx → 검증.

---

## File Structure

- Modify: `web/components/home/NlRecommend.tsx` — `presets` prop + 칩 + submit 일반화.
- Create: `web/components/home/HeroStats.tsx` — 수치 띠 + `HomeStats` 타입.
- Modify: `web/components/home/Hero.tsx` — 재작성(NlRecommend+프리셋+HeroStats+보조링크), HeroSearch 제거.
- Modify: `web/app/page.tsx` — stats fetch/주입, "나에게 맞는 공고" 섹션 제거.

---

### Task 1: NlRecommend에 프리셋 칩 추가

**Files:** Modify `web/components/home/NlRecommend.tsx`

- [ ] **Step 1: submit 일반화 + presets prop + 칩**

(a) 컴포넌트 시그니처에 prop 추가 + Preset 타입 export. 파일 상단(import 아래)에:
```tsx
export type RecommendPreset = { label: string; prompt: string };
```
(b) 함수 시그니처를 `export function NlRecommend({ presets }: { presets?: RecommendPreset[] }) {` 로 변경.

(c) 기존 `async function submit(e: React.FormEvent) { e.preventDefault(); const q = text.trim(); if (!q) return; ... }` 를 쿼리 인자를 받는 `runRecommend`로 리팩터(상태 비동기 문제 회피) + 얇은 `submit`/`handlePreset` 추가:
```tsx
  async function runRecommend(raw: string) {
    const q = raw.trim();
    if (!q) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    localStorage.setItem(STORAGE_KEY, q);
    try {
      const res = await fetch("/api/recommend-nl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q, top_k: 6 }),
        signal: controller.signal,
      });
      if (res.status === 429) {
        setError("요청이 많습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (!res.ok) {
        setError("추천을 불러오지 못했습니다.");
        return;
      }
      setResult((await res.json()) as RecommendResponse);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void runRecommend(text);
  }

  function handlePreset(p: RecommendPreset) {
    setText(p.prompt);
    void runRecommend(p.prompt);
  }
```
(즉, 기존 submit 본문 로직을 그대로 runRecommend로 옮기고, submit은 runRecommend(text) 호출만.)

(d) 폼 아래 안내문(`<p>...6차원 점수로 추천합니다.</p>`) 다음에 프리셋 칩 블록 추가:
```tsx
      {presets && presets.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePreset(p)}
              disabled={loading}
              className="rounded-full border border-border bg-background px-3 py-1 text-caption text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 2: 타입체크** — `cd web && npx tsc --noEmit` → 에러 없음.

- [ ] **Step 3: 커밋**
```bash
git add web/components/home/NlRecommend.tsx
git commit -m "feat(web): NlRecommend 프리셋 칩 지원(추천 로직 재사용)"
```

---

### Task 2: HeroStats 컴포넌트

**Files:** Create `web/components/home/HeroStats.tsx`

- [ ] **Step 1: 구현**
```tsx
export interface HomeStats {
  sponsors: number;
  total: number;
  companies: number;
  countries: number;
}

export function HeroStats({ stats }: { stats: HomeStats }) {
  const items = [
    { value: stats.sponsors, label: "비자 스폰서 공고", accent: true },
    { value: stats.total, label: "전체 공고", accent: false },
    { value: stats.companies, label: "회사", accent: false },
    { value: stats.countries, label: "국가", accent: false },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <div
            className={`text-h3 font-bold ${
              i.accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            }`}
          >
            {i.value.toLocaleString()}
          </div>
          <div className="text-caption text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크** — `cd web && npx tsc --noEmit` → 에러 없음.

- [ ] **Step 3: 커밋**
```bash
git add web/components/home/HeroStats.tsx
git commit -m "feat(web): HeroStats 신뢰 수치 띠 컴포넌트"
```

---

### Task 3: Hero 재작성

**Files:** Modify `web/components/home/Hero.tsx`

- [ ] **Step 1: 전체 교체**

현재 파일 전체를 다음으로 교체:
```tsx
import Link from "next/link";

import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { NlRecommend, type RecommendPreset } from "@/components/home/NlRecommend";

const HERO_PRESETS: RecommendPreset[] = [
  { label: "🎯 비자 스폰서만", prompt: "비자 스폰서십 제공하는 백엔드 개발자 공고" },
  { label: "🇩🇪 독일 백엔드", prompt: "독일 베를린 백엔드 개발자, 비자 스폰서 필요" },
  { label: "🏠 원격 시니어", prompt: "원격 가능한 시니어 소프트웨어 엔지니어" },
  { label: "🤖 AI/ML", prompt: "AI/ML 엔지니어, 비자 스폰서" },
];

export function Hero({ stats }: { stats: HomeStats }) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <p className="text-caption font-semibold uppercase tracking-wide text-primary">
        한국 개발자 · 유럽 진출
      </p>
      <h1 className="mt-2 text-display">
        조건만 말하면, AI가 맞는 <span className="text-primary">비자 스폰서</span> 공고를 찾아드려요
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        이력서·기술스택·원하는 조건을 자유롭게 적어보세요. 6차원 점수로 추천합니다.
      </p>

      <div className="mx-auto mt-6 max-w-2xl text-left">
        <NlRecommend presets={HERO_PRESETS} />
      </div>

      <p className="mt-3 text-body-sm text-muted-foreground">
        또는{" "}
        <Link href="/search" className="underline hover:text-foreground">
          조건으로 직접 검색 →
        </Link>
      </p>

      <HeroStats stats={stats} />
    </section>
  );
}
```

> `regions` prop은 더 이상 Hero에서 안 씀(HeroSearch 제거). `RegionCount` import 제거됨. NlRecommend의 결과 그리드는 좌측 정렬이 자연스러우므로 입력 래퍼에 `text-left` 적용.

- [ ] **Step 2: 타입체크** — `cd web && npx tsc --noEmit` → 에러 없음(아직 page.tsx가 `regions`를 Hero에 넘기면 에러 → Task 4에서 동시 정리. 이 시점 에러는 Task 4 후 해소되므로, Task 3·4를 연속 진행 후 한 번에 tsc 통과 확인).

- [ ] **Step 3: 커밋**
```bash
git add web/components/home/Hero.tsx
git commit -m "feat(web): Hero 대화형 AI 추천 히어로로 재작성(NL+프리셋+수치+보조검색)"
```

---

### Task 4: page.tsx — stats 집계 + 섹션 정리

**Files:** Modify `web/app/page.tsx`

- [ ] **Step 1: 전체 교체**

현재 파일 전체를 다음으로 교체:
```tsx
import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CountryTiles } from "@/components/home/CountryTiles";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { JobScrollRow } from "@/components/home/JobScrollRow";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [visaRes, allRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 1 }),
    fetchJobs({ pageSize: 6, sort: "newest" }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const visaTotal = visaRes.ok ? visaRes.data.total : 0;
  const allTotal = allRes.ok ? allRes.data.total : 0;
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];

  const stats: HomeStats = {
    sponsors: visaTotal,
    total: allTotal,
    companies: companies?.total ?? 0,
    countries: regions.length,
  };

  return (
    <div className="space-y-12">
      <Hero stats={stats} />

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" count={visaTotal} href="/search?visa=sponsors" />
          <JobScrollRow jobs={visaJobs} />
        </section>
      )}

      <section>
        <SectionHeader title="국가별로 찾기" />
        <CountryTiles />
      </section>

      {latestJobs.length > 0 && (
        <section>
          <SectionHeader title="새로 올라온 공고" href="/search" hrefLabel="더 보기" />
          <JobScrollRow jobs={latestJobs} />
        </section>
      )}

      {spotlight.length > 0 && (
        <section>
          <SectionHeader title="주목할 회사" href="/companies" hrefLabel="회사 디렉터리" />
          <CompanySpotlight companies={spotlight} />
        </section>
      )}
    </div>
  );
}
```

> 변경점: `NlRecommend` import·"나에게 맞는 공고" 섹션 제거. `allRes`(전체 total) fetch 추가. `Hero`는 `stats`만 받음(regions 미전달). `CountryTiles`는 자체적으로 데이터 가져오므로 그대로(현재도 props 없이 사용 중).

- [ ] **Step 2: 타입체크 (Task 3+4 통합 확인)** — `cd web && npx tsc --noEmit` → 에러 없음. (Hero가 regions 안 받고 stats만 받음 ↔ page에서 stats만 전달, 일치.)

- [ ] **Step 3: 커밋**
```bash
git add web/app/page.tsx
git commit -m "feat(web): 홈 page.tsx stats 집계 + Hero 주입 + 중복 추천 섹션 제거"
```

---

### Task 5: 라이브 비주얼 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 타입체크 최종** — `cd web && npx tsc --noEmit` → 에러 없음. lint 있으면 `npm run lint`.

- [ ] **Step 2: dev 스택** — worktree web 별도 포트: `cd web && PORT=3001 BACKEND_URL=http://localhost:8080 npm run dev`. 백엔드(:8080)·Postgres(:5433) 가동 확인.

- [ ] **Step 3: Playwright `/` 확인**
- 히어로: 헤드라인 + NL 입력 + 프리셋 칩 4개 + 수치 띠(스폰서/전체/회사/국가) 표시.
- 프리셋 칩(예 "🇩🇪 독일 백엔드") 클릭 → 잠시 후 추천 카드 인페이지 렌더(또는 빈결과 메시지).
- "나에게 맞는 공고" 섹션 없음(중복 제거 확인).
- "조건으로 직접 검색 →" 클릭 시 /search 이동.
- DOM eval: 수치 띠 값이 실제 API total과 일치(스폰서>0). 스크린샷.

- [ ] **Step 4: 보고** — 스크린샷 + 동작 요약. 검증 전용, 커밋 없음.

> 라이브 스택 미가동 시 Step 1 타입체크까지만, 비주얼은 머지 후로.

---

## Self-Review

- **Spec coverage:** §4.1 Hero → Task 3. §4.2 NlRecommend 프리셋 → Task 1. §4.3 HeroStats → Task 2. §4.4 page.tsx(stats·섹션 제거) → Task 4. §6 검증 → Task 5. 누락 없음. 헤더는 스펙대로 범위 밖.
- **Placeholder scan:** TBD/TODO 없음. 모든 스텝 실제 코드/전체 교체 블록. HERO_PRESETS 실제 문구 포함.
- **Type consistency:** `RecommendPreset{label,prompt}`(Task1 export) ↔ Hero의 `HERO_PRESETS: RecommendPreset[]`(Task3) ↔ NlRecommend `presets?` prop. `HomeStats{sponsors,total,companies,countries}`(Task2 export) ↔ Hero `{stats: HomeStats}`(Task3) ↔ page `stats: HomeStats`(Task4). `companies?.total`은 CompanyListResponse.total(존재 확인됨). `allRes.data.total`은 JobsResult ok 분기 total. Hero가 regions를 더는 안 받음 ↔ page에서 미전달(일치). NlRecommend `runRecommend(raw)` 리팩터로 칩 클릭 시 상태 비동기 문제 회피.
- **주의:** Task 3 단독 tsc는 page가 아직 regions 전달 중이면 에러날 수 있으나, Task 3·4를 연속 커밋 후 Task 4 Step 2에서 통합 tsc 통과를 확인(서브에이전트 실행 시 두 태스크 연속 처리). 각 커밋은 독립적이나 tsc 그린 게이트는 Task 4 후 적용.
