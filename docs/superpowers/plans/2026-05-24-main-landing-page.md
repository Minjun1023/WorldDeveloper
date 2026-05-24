# 메인 랜딩 페이지 구현 계획 (Plan 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/`를 검색 결과 페이지에서 큐레이션형 랜딩 페이지로 전환하고, 기존 검색은 `/search`로 옮긴다.

**Architecture:** Next.js 14 App Router 서버 컴포넌트. 랜딩은 섹션 데이터를 `Promise.all`로 병렬 fetch하고 각 섹션은 독립 실패해도 페이지는 정상. 모든 데이터는 기존 API(`fetchJobs`, `fetchCompanies`) 재사용. 맞춤 추천 섹션은 이 plan에서는 `/recommend`로 가는 CTA로 두고 Plan 2가 인라인 NL 추천으로 교체한다.

**Tech Stack:** Next.js 14, TypeScript, Tailwind (기존 DESIGN.md 토큰), 기존 컴포넌트(JobCard, Card, Button, Input).

**검증 방식:** web에 테스트 프레임워크가 없으므로 `npm run typecheck` + `npm run build` + `npm run lint` + 브라우저 시각 확인으로 검증한다 (프로젝트 현행 방식). 단위 테스트는 도입하지 않는다.

**관련 설계:** `docs/superpowers/specs/2026-05-24-main-landing-page-design.md`, 비주얼: `web/DESIGN.md`(랜딩 컴포넌트 절).

---

## 파일 구조

```
web/
├── app/
│   ├── page.tsx                    (교체) 검색 → 랜딩
│   ├── search/page.tsx             (신규, 이동) 기존 검색 로직
│   ├── layout.tsx                  (수정) nav "검색" → /search
│   └── globals.css                 (수정) .hero-gradient 클래스
└── components/home/                (신규)
    ├── SectionHeader.tsx           제목 + 의미색 점 + 전체보기 링크
    ├── Hero.tsx                    카피 + 검색 + 칩 (서버)
    ├── HeroSearch.tsx              /search 로 navigate (클라이언트)
    ├── JobScrollRow.tsx            JobCard 가로 스크롤
    ├── CountryTiles.tsx            국가 바로가기 타일
    ├── CompanySpotlight.tsx        회사 카드 그리드
    └── RecommendCta.tsx            맞춤추천 자리(임시 CTA → Plan 2가 교체)
```

각 컴포넌트는 단일 책임. 모두 작고 표현형이라 따로 둔다.

---

## Task 1: SectionHeader 컴포넌트

섹션 제목 + (옵션) 의미색 점 + (옵션) "전체 보기" 링크. 모든 섹션이 공유.

**Files:**
- Create: `web/components/home/SectionHeader.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import Link from "next/link";

type Accent = "visa" | "recommend";

const DOT: Record<Accent, string> = {
  visa: "bg-success",
  recommend: "bg-primary",
};

export function SectionHeader({
  title,
  accent,
  href,
  hrefLabel = "전체 보기",
}: {
  title: string;
  accent?: Accent;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="flex items-center gap-2 text-h2">
        {accent && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[accent]}`}
            aria-hidden
          />
        )}
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-body-sm text-primary hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
```

> 참고: `bg-success`/`bg-primary` 는 tailwind.config.ts 에 정의된 색. 없으면 `bg-[var(--success)]`/`bg-[var(--primary)]` 로 대체.

- [ ] **Step 2: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/SectionHeader.tsx
git commit -m "feat(home): SectionHeader 컴포넌트"
```

---

## Task 2: Hero + HeroSearch

큰 카피 + 검색 입력(`/search`로 이동) + 빠른 필터칩. 그라데이션 배경.

**Files:**
- Create: `web/components/home/HeroSearch.tsx` (클라이언트)
- Create: `web/components/home/Hero.tsx` (서버)

- [ ] **Step 1: HeroSearch 작성 (클라이언트, /search 로 navigate)**

`web/components/home/HeroSearch.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
      className="mx-auto flex max-w-xl gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="python backend berlin, react senior ..."
        aria-label="공고 검색"
        className="font-mono"
      />
      <Button type="submit">검색</Button>
    </form>
  );
}
```

- [ ] **Step 2: Hero 작성 (서버)**

`web/components/home/Hero.tsx`:

```tsx
import Link from "next/link";

import { HeroSearch } from "@/components/home/HeroSearch";

const CHIPS: { label: string; href: string }[] = [
  { label: "비자 스폰서", href: "/search?visa=sponsors" },
  { label: "원격 가능", href: "/search?remote=true" },
];

export function Hero() {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <h1 className="text-display">
        EU <span className="text-primary">비자 스폰서</span> 공고, 한 곳에서.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        한국 개발자의 유럽 진출 — 비자 스폰서십 명시 공고 + 6차원 맞춤 추천.
      </p>
      <div className="mt-6">
        <HeroSearch />
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

> `.hero-gradient` 클래스는 Task 7에서 globals.css에 추가한다. 그 전 빌드에서도 배경만 비어 보일 뿐 에러는 없다.

- [ ] **Step 3: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add web/components/home/Hero.tsx web/components/home/HeroSearch.tsx
git commit -m "feat(home): Hero + HeroSearch (검색은 /search 로 이동)"
```

---

## Task 3: JobScrollRow

`Job[]`을 받아 기존 `JobCard`를 가로 스크롤로 배치. 비자·신규 섹션이 사용.

**Files:**
- Create: `web/components/home/JobScrollRow.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

export function JobScrollRow({ jobs }: { jobs: Job[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {jobs.map((job) => (
        <div key={job.id} className="w-[300px] shrink-0">
          <JobCard job={job} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (`Job` 타입과 `JobCard` props 일치)

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/JobScrollRow.tsx
git commit -m "feat(home): JobScrollRow (JobCard 가로 스크롤)"
```

---

## Task 4: CountryTiles

국가 바로가기 타일. 정적 목록 → `/search?location=`.

**Files:**
- Create: `web/components/home/CountryTiles.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import Link from "next/link";

const COUNTRIES: { name: string; cities: string; location: string }[] = [
  { name: "독일", cities: "Berlin · Munich", location: "Germany" },
  { name: "네덜란드", cities: "Amsterdam", location: "Netherlands" },
  { name: "영국", cities: "London", location: "United Kingdom" },
  { name: "아일랜드", cities: "Dublin", location: "Ireland" },
];

export function CountryTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Link
          key={c.location}
          href={`/search?location=${encodeURIComponent(c.location)}`}
          className="rounded-lg border border-border bg-surface-2 p-4 transition-colors hover:border-primary/40"
        >
          <div className="font-semibold">{c.name}</div>
          <div className="mt-1 text-caption text-muted-foreground">{c.cities}</div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/CountryTiles.tsx
git commit -m "feat(home): CountryTiles 국가 바로가기"
```

---

## Task 5: CompanySpotlight

`CompanySummary[]`를 받아 회사 카드 그리드. 기존 `/companies` 카드 패턴 재사용.

**Files:**
- Create: `web/components/home/CompanySpotlight.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { CompanySummary } from "@/lib/types";

export function CompanySpotlight({ companies }: { companies: CompanySummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {companies.map((c) => (
        <Link key={c.slug} href={`/companies/${c.slug}`}>
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-bold text-primary">
                {c.display_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-body-sm font-semibold">{c.display_name}</span>
              <span className="text-caption text-muted-foreground">{c.job_count}개 공고</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (`CompanySummary.display_name`/`slug`/`job_count` 사용)

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/CompanySpotlight.tsx
git commit -m "feat(home): CompanySpotlight 회사 스포트라이트"
```

---

## Task 6: RecommendCta (맞춤추천 자리 임시 CTA)

맞춤 추천 섹션의 자리. Plan 1에서는 `/recommend`로 가는 CTA 카드. **Plan 2가 인라인 NL 추천(`NlRecommend`)으로 교체한다.**

**Files:**
- Create: `web/components/home/RecommendCta.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function RecommendCta() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-body-sm text-muted-foreground">
        스택·연차·선호 지역을 입력하면 6차원 점수로 맞춤 공고를 추천해드려요.
      </p>
      <Link href="/recommend" className="mt-4 inline-block">
        <Button>맞춤 추천 받기</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/RecommendCta.tsx
git commit -m "feat(home): RecommendCta (Plan 2에서 인라인 NL 추천으로 교체 예정)"
```

---

## Task 7: 라우팅 전환 + 랜딩 페이지 조립 + nav

검색을 `/search`로 이동하고, `/`에 랜딩 페이지를 만들어 섹션을 병렬 fetch + 조립. nav 링크 수정. globals.css 그라데이션 추가.

**Files:**
- Move: `web/app/page.tsx` → `web/app/search/page.tsx`
- Create: `web/app/page.tsx` (랜딩)
- Modify: `web/app/layout.tsx` (nav "검색" → `/search`)
- Modify: `web/app/globals.css` (`.hero-gradient`)

- [ ] **Step 1: 검색 페이지 이동**

```bash
cd web
git mv app/page.tsx app/search/page.tsx
```

그리고 `app/search/page.tsx`의 함수명을 변경 (동작 동일):

`export default async function HomePage(` → `export default async function SearchPage(`

- [ ] **Step 2: globals.css에 그라데이션 추가**

`web/app/globals.css` 끝에 추가:

```css
.hero-gradient {
  background: linear-gradient(125deg, #f5f3ff 0%, #faf5ff 35%, #ffffff 80%);
}
.dark .hero-gradient {
  background: radial-gradient(60% 80% at 50% 0%, rgba(99, 102, 241, 0.12), transparent 70%), #09090b;
}
```

- [ ] **Step 3: 랜딩 페이지 작성**

`web/app/page.tsx` (신규):

```tsx
import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CountryTiles } from "@/components/home/CountryTiles";
import { Hero } from "@/components/home/Hero";
import { JobScrollRow } from "@/components/home/JobScrollRow";
import { RecommendCta } from "@/components/home/RecommendCta";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [visaRes, latestRes, companies] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 6 }),
    fetchCompanies(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];

  return (
    <div className="space-y-12">
      <Hero />

      <section>
        <SectionHeader title="나에게 맞는 공고" accent="recommend" href="/recommend" hrefLabel="정교한 추천 설정" />
        <RecommendCta />
      </section>

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" href="/search?visa=sponsors" />
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

- [ ] **Step 4: layout.tsx nav 수정**

`web/app/layout.tsx`에서 검색 링크 변경:

```tsx
<a href="/search" className="hover:text-foreground transition-colors">검색</a>
```

(기존 `<a href="/" ...>검색</a>` 한 줄을 위로 교체. 로고의 `href="/"`는 랜딩이므로 그대로 둔다.)

- [ ] **Step 5: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 둘 다 성공. `app/search`와 `app/`(landing) 라우트가 빌드 출력에 보임

- [ ] **Step 6: 커밋**

```bash
git add web/app/page.tsx web/app/search/page.tsx web/app/layout.tsx web/app/globals.css
git commit -m "feat(home): / 를 랜딩으로 전환, 검색은 /search 로 이동"
```

---

## Task 8: 브라우저 시각 검증 + 반응형/다크 점검

**Files:** (코드 변경 없을 수 있음 — 발견된 이슈만 수정)

- [ ] **Step 1: 백엔드 + 웹 기동**

```bash
# 별도 터미널: 백엔드 (DB 포함). 루트에서:
./dev.sh
# 또는 개별 기동은 README 참고. 웹:
cd web && npm run dev
```

- [ ] **Step 2: 데스크톱 시각 확인 (http://localhost:3000)**

확인 항목:
- Hero 그라데이션 + 카피 + 검색 + 칩 표시
- 검색바에 입력 후 제출 → `/search?q=...` 이동, 기존 검색 결과 정상
- 비자 섹션(녹색 점), 국가 타일, 신규 공고, 회사 스포트라이트 렌더
- "전체 보기" 링크들이 올바른 쿼리로 이동
- 백엔드 미기동 시: Hero·국가 타일·추천 CTA는 보이고 공고/회사 섹션은 숨김(페이지 안 깨짐)

- [ ] **Step 3: 다크모드 + 모바일**

- 헤더 테마 토글 → 다크에서 Hero 글로우 배경, 대비 확인
- 브라우저 폭 375px: 국가 타일 2열, 가로 스크롤 스와이프, 카피 안 깨짐

> 시각 검증은 브라우저 직접 확인 또는 프로젝트의 browse/gstack 도구로 스크린샷. 이슈 발견 시 해당 컴포넌트 수정 후 Step 2~3 재확인.

- [ ] **Step 4: lint + 최종 커밋 (수정이 있었던 경우)**

```bash
cd web && npm run lint
git add -A
git commit -m "fix(home): 시각 검증 후 반응형/다크 보정"
```

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: 라우팅 전환(Task 7) ✓, Hero(2) ✓, 비자/신규 JobScrollRow(3,7) ✓, 국가 타일(4) ✓, 회사 스포트라이트(5) ✓, 맞춤추천 자리=CTA(6, Plan 2가 교체) ✓, 섹션 독립 실패 격리(7 page) ✓, 비주얼 하이브리드/그라데이션(2,7) ✓, 반응형·다크(8) ✓.
- **플레이스홀더**: 모든 단계에 실제 코드 포함, TODO 없음.
- **타입 일관성**: `Job`(JobScrollRow), `CompanySummary.display_name/slug/job_count`(CompanySpotlight), `fetchJobs`/`fetchCompanies` 반환형(page) 실제 정의와 일치.
- **범위 밖(Plan 2)**: 자연어 맞춤 추천(ai parse + /api/v1/recommend/nl + nl_profile_cache + /api/recommend-nl + NlRecommend). RecommendCta를 NlRecommend로 교체.
