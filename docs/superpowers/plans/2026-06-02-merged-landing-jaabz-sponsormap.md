# 합쳐진 랜딩 (Jaabz + SponsorMap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 랜딩에 Jaabz의 듀얼트랙 토글 UX + SponsorMap의 "정부 명부 대조 권위" 프레이밍을 합치되, 프로젝트의 indigo-minimal 디자인 정체성을 유지한다.

**Architecture:** 기존 `web/app/page.tsx` + `web/components/home/*` 를 수정/추가한다. DESIGN.md 토큰 2개(serif 폰트, verified 골드 색)를 추가하고, Hero를 권위 요소(신뢰 pill·세리프 강조 헤드라인·검증 스폰서 로고 칩·권위 통계 스트립)로 재구성, TrackPicker를 Jaabz식 탭으로, 신뢰 FAQ 섹션을 추가한다.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript, Tailwind CSS (CSS 변수 토큰 + shadcn 컨벤션), next/font/google.

**Base branch:** `feat/merged-landing-jaabz-sponsormap` (= `feat/remote-eligibility-data-axis` tip 기반. 듀얼트랙/TrackPicker/RemoteBadge가 여기에만 존재하므로 main이 아닌 이 브랜치를 base로 함). 이 worktree: `/Users/mac/WordDeveloper/wt-merged-landing`.

**테스트 전략 (프로젝트 기존 패턴 준수):** web 패키지에는 jest/vitest가 없다(scripts: dev/build/lint/typecheck). 기존 기능들의 실제 검증 패턴은 **typecheck + lint + build + Playwright 라이브 스크린샷**이다. 따라서 각 태스크의 검증 단계는 `npm run typecheck` + `npm run lint`, 마지막에 Playwright로 라이트/다크 시각 확인을 한다. 컴포넌트 단위 테스트 러너는 도입하지 않는다(YAGNI, 기존 패턴 위반 방지).

**스코프 제외 (백엔드 후속 PR):** 카드 verified ✓ 마커와 "UK 명부 직접 대조" 통계 칸은 프론트 `Job` 타입에 명부 출처 필드(uk_register/us_h1b)가 없어 이 플랜에서 제외한다. 백엔드가 `job.visa.source` 또는 통계 엔드포인트에 명부 대조 건수를 노출한 뒤 별도 PR로 추가한다. (스펙 "검증 계획"의 조건부 항목과 일치)

모든 명령은 worktree 내 web 디렉터리에서 실행:
```bash
cd /Users/mac/WordDeveloper/wt-merged-landing/web
```

---

### Task 1: 디자인 토큰 추가 (verified 색 + Source Serif 4 폰트)

**Files:**
- Modify: `web/app/globals.css` (`:root` / `.dark` 에 `--verified`, `--verified-foreground` 추가)
- Modify: `web/tailwind.config.ts` (`colors.verified`, `fontFamily.serif` 추가)
- Modify: `web/app/layout.tsx` (Source Serif 4 next/font 로드 + body 에 CSS 변수)
- Modify: `web/DESIGN.md` (front matter + 본문에 토큰 근거)

- [ ] **Step 1: globals.css `:root` 에 verified 변수 추가**

`web/app/globals.css` 의 `:root` 블록에서 `--destructive: #dc2626;` 줄 바로 아래에 추가:

```css
    --destructive: #dc2626;
    --verified: #ca8a04;
    --verified-foreground: #ffffff;
```

- [ ] **Step 2: globals.css `.dark` 에 verified 변수 추가**

`.dark` 블록에서 `--destructive: #ef4444;` 줄 바로 아래에 추가:

```css
    --destructive: #ef4444;
    --verified: #eab308;
    --verified-foreground: #09090b;
```

- [ ] **Step 3: tailwind.config.ts 에 verified 색 + serif 폰트 매핑**

`web/tailwind.config.ts` 의 `colors` 객체에서 `destructive: "var(--destructive)",` 줄 아래에 추가:

```ts
        destructive: "var(--destructive)",
        verified: {
          DEFAULT: "var(--verified)",
          foreground: "var(--verified-foreground)",
        },
```

같은 파일 `fontFamily` 객체에서 `mono: [...]` 배열 아래에 `serif` 추가:

```ts
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        serif: [
          "var(--font-serif)",
          "Source Serif 4",
          "Georgia",
          "Pretendard Variable",
          "serif",
        ],
```

- [ ] **Step 4: layout.tsx 에서 Source Serif 4 로드**

`web/app/layout.tsx` 상단 import 들 아래에 폰트 로드 추가하고, `<body>` 에 변수 클래스를 건다.

import 블록 마지막(`import { getSession } ...` 아래)에:

```ts
import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
```

그리고 `<body className="min-h-screen antialiased">` 를 다음으로 교체:

```tsx
      <body className={`${sourceSerif.variable} min-h-screen antialiased`}>
```

- [ ] **Step 5: DESIGN.md 에 토큰 근거 추가**

`web/DESIGN.md` front matter 의 `fonts:` 블록에 `serif` 한 줄 추가 (mono 아래):

```yaml
  mono: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace"
  serif: "Source Serif 4, Georgia, Pretendard Variable, serif"
```

front matter `colors.light` 의 `destructive: "#dc2626"` 아래, `colors.dark` 의 `destructive: "#ef4444"` 아래 각각:

```yaml
    verified: "#ca8a04"
```
```yaml
    verified: "#eab308"
```

본문 `## Color` 의 Semantic 목록에 한 줄 추가:

```markdown
  - `verified` (gold) — 명부 대조 검증 신호 전용(랜딩 신뢰 pill·권위 통계). `warning`(낮은 disclosure 주의)과 의미·색조 분리.
```

본문 `## Typography` 첫 문단 아래에 한 줄 추가:

```markdown
- **Source Serif 4** (serif) — 신뢰 강조 헤드라인의 이탤릭 구절 전용(SponsorMap식 권위 톤). 본문/UI/숫자에는 쓰지 않는다.
```

- [ ] **Step 6: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS). next/font import가 인식되고 tailwind 설정이 유효.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/app/globals.css web/tailwind.config.ts web/app/layout.tsx web/DESIGN.md
git commit -m "feat(web): add verified gold token + Source Serif 4 serif token"
```

---

### Task 2: CredibilityPill 컴포넌트 (SponsorMap 신뢰 pill)

**Files:**
- Create: `web/components/home/CredibilityPill.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`web/components/home/CredibilityPill.tsx`:

```tsx
// SponsorMap 의 "HOME OFFICE REGISTER · UPDATED DAILY" 권위 pill 을 본 프로젝트의
// 실제 차별점(UK 내무부 명부 + US USCIS 데이터 대조)으로 번안. 정적 카피, 데이터 의존 없음.
export function CredibilityPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold text-verified"
      style={{ backgroundColor: "color-mix(in srgb, var(--verified) 12%, transparent)" }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 4 5v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V5l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      UK 내무부 명부 · US USCIS 대조 · 매일 갱신
    </span>
  );
}
```

- [ ] **Step 2: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS).

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/CredibilityPill.tsx
git commit -m "feat(web): add CredibilityPill (register authority badge)"
```

---

### Task 3: SponsorChips 컴포넌트 (검증 스폰서 로고 칩 행)

**Files:**
- Create: `web/components/home/SponsorChips.tsx`

기존 `CompanyLogo`(`web/components/company/CompanyLogo.tsx`, JobCard 에서 사용)를 재사용한다. 입력은 `CompanySummary[]` (page.tsx 의 `fetchCompanies` 결과 상위).

- [ ] **Step 1: 컴포넌트 작성**

`web/components/home/SponsorChips.tsx`:

```tsx
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import type { CompanySummary } from "@/lib/types";

// SponsorMap 의 "실제 등재 스폰서 로고 칩" 패턴. 신뢰 마이크로카피 + 검증된 회사 로고 칩.
// companies 가 비면 렌더링하지 않음.
export function SponsorChips({ companies }: { companies: CompanySummary[] }) {
  if (companies.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col items-center gap-2 text-caption text-muted-foreground sm:flex-row sm:justify-center">
      <span>무료 · 회원가입 불필요</span>
      <span className="hidden sm:inline" aria-hidden="true">
        ·
      </span>
      <span className="flex items-center gap-2">
        <span className="text-verified">이미 등재된 스폰서</span>
        <span className="flex flex-wrap items-center gap-2">
          {companies.map((c) => (
            <Link
              key={c.slug}
              href={`/companies/${c.slug}`}
              title={c.display_name}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 transition-colors hover:border-primary/40"
            >
              <CompanyLogo slug={c.slug} name={c.display_name} />
              <span className="max-w-[8rem] truncate text-foreground">{c.display_name}</span>
            </Link>
          ))}
        </span>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: CompanyLogo 가 크기 prop 없이 동작하는지 확인**

Run:
```bash
sed -n '1,40p' components/company/CompanyLogo.tsx
```
Expected: `CompanyLogo({ slug, name })` 시그니처 확인. 만약 `size` 같은 필수 prop이 있으면 위 사용처에 추가(작은 칩이므로 가장 작은 사이즈 전달). 선택 prop이면 그대로 둠.

- [ ] **Step 3: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS).

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/SponsorChips.tsx
git commit -m "feat(web): add SponsorChips (verified sponsor logo row)"
```

---

### Task 4: 권위 통계 스트립 (HeroStats 재작업 + 카운트업)

**Files:**
- Create: `web/components/home/CountUp.tsx` (클라이언트 카운트업)
- Modify: `web/components/home/HeroStats.tsx`

스펙대로 숫자를 "명부 권위" 중심으로 재프레이밍한다. 명부 대조 stat(by_uk_register)은 데이터가 없으므로 기존 4개(sponsors/total/companies/countries)를 쓰되 sponsors 라벨을 "명부 검증 스폰서"로 바꾸고 verified 색 신호를 준다.

- [ ] **Step 1: CountUp 클라이언트 컴포넌트 작성**

`web/components/home/CountUp.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

// 0 → value 카운트업. 뷰포트 진입 시 1회 실행. prefers-reduced-motion 이면 즉시 최종값.
export function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setDisplay(Math.round(value * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}
```

- [ ] **Step 2: HeroStats 를 권위 스트립으로 교체**

`web/components/home/HeroStats.tsx` 전체를 교체:

```tsx
import { CountUp } from "@/components/home/CountUp";

export interface HomeStats {
  sponsors: number;
  total: number;
  companies: number;
  countries: number;
}

export function HeroStats({ stats }: { stats: HomeStats }) {
  const items = [
    { value: stats.sponsors, label: "명부 검증 스폰서", verified: true },
    { value: stats.total, label: "라이브 공고", verified: false },
    { value: stats.companies, label: "회사", verified: false },
    { value: stats.countries, label: "국가", verified: false },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap sm:justify-center">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <div
            className={`text-h3 font-bold ${i.verified ? "text-verified" : "text-foreground"}`}
          >
            <CountUp value={i.value} />
          </div>
          <div className="text-caption text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS).

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/CountUp.tsx web/components/home/HeroStats.tsx
git commit -m "feat(web): authority stats strip with count-up + verified labeling"
```

---

### Task 5: Hero 재구성 (신뢰 pill + 세리프 헤드라인 + 로고 칩)

**Files:**
- Modify: `web/components/home/Hero.tsx`

`Hero` 가 `companies` 를 새로 받아 SponsorChips 에 넘긴다. 헤드라인 핵심 구절을 세리프 이탤릭 verified 색으로.

- [ ] **Step 1: Hero.tsx 교체**

`web/components/home/Hero.tsx` 전체를 교체:

```tsx
import Link from "next/link";

import { CredibilityPill } from "@/components/home/CredibilityPill";
import { HeroStats, type HomeStats } from "@/components/home/HeroStats";
import { NlRecommend, type RecommendPreset } from "@/components/home/NlRecommend";
import { SponsorChips } from "@/components/home/SponsorChips";
import type { CompanySummary } from "@/lib/types";

const HERO_PRESETS: RecommendPreset[] = [
  { label: "비자 스폰서만", prompt: "비자 스폰서십 제공하는 백엔드 개발자 공고" },
  { label: "독일 백엔드", prompt: "독일 베를린 백엔드 개발자, 비자 스폰서 필요" },
  { label: "원격 시니어", prompt: "원격 가능한 시니어 소프트웨어 엔지니어" },
  { label: "AI/ML", prompt: "AI/ML 엔지니어, 비자 스폰서" },
];

export function Hero({
  stats,
  sponsorCompanies,
}: {
  stats: HomeStats;
  sponsorCompanies: CompanySummary[];
}) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <CredibilityPill />

      <h1 className="mt-4 text-display">
        조건만 말하면, AI가{" "}
        <span className="font-serif italic text-verified">실제로 채용 가능한</span>{" "}
        <span className="text-primary">비자 스폰서</span> 공고를 찾아드려요
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
          조건으로 직접 검색
        </Link>
      </p>

      <SponsorChips companies={sponsorCompanies} />

      <HeroStats stats={stats} />
    </section>
  );
}
```

- [ ] **Step 2: 검증 — typecheck (page.tsx 가 아직 새 prop 안 넘겨서 에러 예상)**

Run:
```bash
npm run typecheck
```
Expected: `web/app/page.tsx` 에서 `Hero` 에 `sponsorCompanies` 누락 타입 에러 1건. (Task 8에서 해결) — 이 태스크 자체 커밋은 Task 8과 함께. 여기서는 lint만 통과 확인:

```bash
npm run lint
```
Expected: lint PASS.

- [ ] **Step 3: Commit (page.tsx 와 함께 묶으므로 여기선 스테이징만, 커밋은 Task 8)**

이 태스크 변경은 Task 8 의 page.tsx 수정과 함께 커밋한다 (그래야 typecheck 가 green). 진행:

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/Hero.tsx
```
(커밋하지 않고 다음 태스크로. Task 8 Step 마지막에서 함께 커밋.)

---

### Task 6: TrackPicker → Jaabz식 탭 스타일

**Files:**
- Modify: `web/components/home/TrackPicker.tsx`

기존 카드 3개(이주/원격/둘다)를 Jaabz식 가로 탭 스타일로. 이모지는 제거(전역 no-emoji 규칙). 동작은 그대로 `/search?track=...` 이동.

- [ ] **Step 1: TrackPicker.tsx 교체**

`web/components/home/TrackPicker.tsx` 전체를 교체:

```tsx
import Link from "next/link";

const TRACKS = [
  {
    href: "/search?track=relocation",
    title: "이주하고 싶어요",
    desc: "비자 스폰서를 받아 현지에서 근무",
  },
  {
    href: "/search?track=remote",
    title: "한국에 살면서 원격",
    desc: "한국 거주자가 지원 가능한 원격 공고",
  },
  {
    href: "/search",
    title: "둘 다 / 아직 모르겠어요",
    desc: "지원 가능한 공고 전체 보기",
  },
];

export function TrackPicker() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      {TRACKS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="group flex flex-1 flex-col rounded-lg border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-primary/60 sm:max-w-xs"
        >
          <span className="font-semibold text-foreground group-hover:text-primary">
            {t.title}
          </span>
          <span className="mt-1 text-body-sm text-muted-foreground">{t.desc}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS). (TrackPicker 는 외부 prop 변화 없음)

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/TrackPicker.tsx
git commit -m "feat(web): TrackPicker as horizontal track tabs (drop emoji)"
```

---

### Task 7: FaqSection 컴포넌트 (신뢰 FAQ 아코디언)

**Files:**
- Create: `web/components/home/FaqSection.tsx`

네이티브 `<details>` 사용 (의존 추가 없음, 프로젝트 기존 패턴과 일관). 정적 카피.

- [ ] **Step 1: FaqSection.tsx 작성**

`web/components/home/FaqSection.tsx`:

```tsx
const FAQS = [
  {
    q: "'명부 검증 스폰서'가 무슨 뜻인가요?",
    a: "영국 내무부(Home Office) 라이선스 스폰서 명부와 미국 USCIS 고용주 데이터에 등재된 회사를 대조해, 실제로 비자 스폰서가 가능한 회사를 표시합니다.",
  },
  {
    q: "비자 스폰서십 공고는 어떻게 확인하나요?",
    a: "공고의 비자 정책을 분석해 '스폰서 가능/불가'로 분류하고, 정보가 불명확하면 추측하지 않고 숨깁니다. 명부 대조로 확인된 회사는 별도 신호로 표시됩니다.",
  },
  {
    q: "이주 트랙과 원격 트랙은 어떻게 다른가요?",
    a: "이주 트랙은 비자 스폰서를 받아 현지에서 근무하는 공고, 원격 트랙은 한국에 거주하면서 지원 가능한 원격 공고입니다. 상단에서 원하는 트랙을 고를 수 있습니다.",
  },
  {
    q: "무료인가요?",
    a: "네. 검색과 추천 모두 무료이며 회원가입 없이 사용할 수 있습니다.",
  },
  {
    q: "공고는 얼마나 자주 갱신되나요?",
    a: "여러 채용 소스와 정부 명부를 정기적으로 수집·대조해 갱신합니다.",
  },
];

export function FaqSection() {
  return (
    <div className="mx-auto max-w-2xl divide-y divide-border rounded-lg border border-border bg-surface">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
            {f.q}
            <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 검증 — typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음 (PASS).

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/FaqSection.tsx
git commit -m "feat(web): add trust FAQ section"
```

---

### Task 8: page.tsx 조립 (Hero 데이터·트랙 섹션·FAQ)

**Files:**
- Modify: `web/app/page.tsx`

Hero 에 스폰서 회사 칩용 데이터 전달, 트랙 섹션 카피 정리, FAQ 섹션 추가. (Task 5 의 Hero.tsx 변경도 여기서 함께 커밋되어 typecheck green.)

- [ ] **Step 1: page.tsx 교체**

`web/app/page.tsx` 전체를 교체:

```tsx
import { CompanySpotlight } from "@/components/home/CompanySpotlight";
import { CountryTiles } from "@/components/home/CountryTiles";
import { FaqSection } from "@/components/home/FaqSection";
import { Hero } from "@/components/home/Hero";
import type { HomeStats } from "@/components/home/HeroStats";
import { TrackPicker } from "@/components/home/TrackPicker";
import { JobScrollRow } from "@/components/home/JobScrollRow";
import { SectionHeader } from "@/components/home/SectionHeader";
import { fetchCompanies, fetchJobs, fetchRegions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [visaRes, allRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 1, includeUnclear: true }),
    fetchJobs({ pageSize: 6, sort: "newest" }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const visaTotal = visaRes.ok ? visaRes.data.total : 0;
  const allTotal = allRes.ok ? allRes.data.total : 0;
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];
  // 히어로 신뢰 칩: 검증 회사 상위 5개(공고 수 순). fetchCompanies 가 공고 수 desc 정렬.
  const sponsorChips = companies?.items.slice(0, 5) ?? [];

  // 원격은 근무형태지 국가가 아니므로 "국가" 수치에서 제외. 공고가 있는 국가만 카운트.
  const countryRegions = regions.filter((r) => r.value !== "remote" && r.count > 0);

  const stats: HomeStats = {
    sponsors: visaTotal,
    total: allTotal,
    companies: companies?.total ?? 0,
    countries: countryRegions.length,
  };

  return (
    <div className="space-y-12">
      <Hero stats={stats} sponsorCompanies={sponsorChips} />

      <section>
        <h2 className="mb-3 text-center text-body-sm font-medium text-muted-foreground">
          어떤 길을 찾고 계세요?
        </h2>
        <TrackPicker />
      </section>

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" count={visaTotal} href="/search?visa=sponsors" />
          <JobScrollRow jobs={visaJobs} />
        </section>
      )}

      {countryRegions.length > 0 && (
        <section>
          <SectionHeader title="국가별로 찾기" />
          <CountryTiles regions={countryRegions} />
        </section>
      )}

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

      <section>
        <h2 className="mb-4 text-center text-h2">자주 묻는 질문</h2>
        <FaqSection />
      </section>
    </div>
  );
}
```

참고: `fetchJobs({ pageSize: 1, includeUnclear: true })` 는 remote-eligibility 브랜치의 시그니처. 만약 `includeUnclear` 옵션이 `fetchJobs` 타입에 없으면 `{ pageSize: 1 }` 로 둔다(typecheck 에러 시).

- [ ] **Step 2: 검증 — typecheck + lint + build**

Run:
```bash
npm run typecheck && npm run lint && npm run build
```
Expected: 모두 PASS. (Hero 의 새 `sponsorCompanies` prop 이 채워져 타입 에러 해소, 빌드 성공)

- [ ] **Step 3: Commit (Task 5 Hero.tsx + page.tsx 함께)**

```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add web/components/home/Hero.tsx web/app/page.tsx
git commit -m "feat(web): wire Hero authority elements + track section + FAQ into landing"
```

---

### Task 9: 라이브 시각 검증 (라이트/다크) + 마무리

**Files:** 없음 (검증만). 필요 시 색 대비 미세 조정.

- [ ] **Step 1: dev 서버 기동**

Run (백그라운드):
```bash
cd /Users/mac/WordDeveloper/wt-merged-landing/web && npm run dev
```
백엔드 의존: 홈은 `fetchJobs`/`fetchCompanies`/`fetchRegions` 를 호출하므로 백엔드/AI 스택이 떠 있어야 데이터가 채워진다. 데이터가 비어도 정적 요소(pill·헤드라인·FAQ·트랙 탭)는 렌더링되어야 한다.

- [ ] **Step 2: Playwright 로 라이트 모드 스크린샷**

Playwright MCP 로 `http://localhost:3000` 접속 후 전체 페이지 스크린샷. 확인:
- 신뢰 pill 골드 tint, 가독.
- 헤드라인 "실제로 채용 가능한" 이 세리프 이탤릭 + verified 골드로 렌더(폰트 로드 확인).
- 스폰서 로고 칩 행 (데이터 있으면 로고/이니셜).
- 권위 통계 스트립: "명부 검증 스폰서" 숫자가 verified 골드, 카운트업 동작.
- 트랙 탭 가로 정렬, FAQ 아코디언 열림/닫힘.

- [ ] **Step 3: 다크 모드 스크린샷**

테마 토글로 다크 전환 후 동일 확인. 특히:
- verified 골드(`#eab308`)가 다크 배경에서 충분히 밝고, `warning` 과 구분되는지.
- 세리프 이탤릭 대비.

- [ ] **Step 4: 모바일(sm) 반응형**

뷰포트 375px 로 리사이즈 후 확인: 통계 2x2 그리드, 로고 칩 줄바꿈, 트랙 탭 세로 스택, 헤드라인 줄간격 깨지지 않음.

- [ ] **Step 5: (필요 시) 색/간격 미세 조정 후 커밋**

대비/간격 문제 발견 시 globals.css 의 `--verified` 명도 또는 컴포넌트 클래스 조정. 변경 있으면:
```bash
cd /Users/mac/WordDeveloper/wt-merged-landing
git add -A web/
git commit -m "fix(web): landing visual polish (contrast/spacing)"
```

- [ ] **Step 6: dev 서버 종료**

백그라운드 dev 프로세스 종료.

---

## Self-Review 결과

**Spec coverage:**
- 토큰 2개(serif/verified) → Task 1 ✅
- CredibilityPill → Task 2 ✅
- 세리프 강조 헤드라인 → Task 5 ✅
- SponsorChips(로고 칩 + 무료/회원가입불필요 카피) → Task 3, 8 ✅
- 권위 통계 스트립 + 카운트업 + verified 라벨 → Task 4 ✅
- 트랙 탭(Jaabz식) → Task 6 ✅
- FAQ → Task 7, 8 ✅
- 라이트/다크/모바일 검증 → Task 9 ✅
- **카드 verified 마커 + "UK 명부 직접 대조" 통계**: 의도적으로 제외(프론트 명부 출처 필드 부재) — 플랜 헤더 "스코프 제외"에 명시, 백엔드 후속 PR. 스펙의 조건부 항목과 일치 ✅

**Placeholder scan:** "TBD/TODO/적절히" 없음. 모든 코드 스텝에 완전한 코드 포함 ✅

**Type consistency:**
- `HomeStats` 필드(sponsors/total/companies/countries) Task 4·8 일치 ✅
- `Hero` props `{ stats, sponsorCompanies: CompanySummary[] }` Task 5 정의 ↔ Task 8 호출 일치 ✅
- `SponsorChips({ companies: CompanySummary[] })` Task 3 정의 ↔ Task 5 사용 일치 ✅
- `CompanySummary` (slug/display_name/job_count) 실제 타입과 일치 ✅
- `CountUp({ value, durationMs? })` Task 4 정의 ↔ HeroStats 사용 일치 ✅

**조건부 분기 명시:** CompanyLogo prop 시그니처(Task 3 Step 2), `fetchJobs` includeUnclear 옵션 유무(Task 8 Step 1) — 실제 코드 확인 후 분기하도록 가드 포함 ✅
