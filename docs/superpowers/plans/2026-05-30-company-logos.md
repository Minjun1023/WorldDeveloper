# 공고 카드 회사 로고 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 공고 카드·추천 카드·상세 헤더에 회사 로고(favicon)를 표시하고, 실패 시 이니셜 아바타로 폴백한다.

**Architecture:** 웹 전용. 클라이언트가 이미 가진 `company.slug`로 `{slug}.com`을 추론 → DuckDuckGo favicon URL → `<img>` 표시, `onError` 시 이니셜 아바타. 백엔드/DB/ETL/companies.json 변경 없음.

**Tech Stack:** Next.js 14 App Router / React / TypeScript / Tailwind. **웹에 테스트 러너가 없으므로** 검증은 `npx tsc --noEmit`(타입) + 라이브 비주얼(dev 스택 + Playwright)로 한다(새 테스트 인프라 도입 안 함 — 기존 관행).

설계 전문: `docs/superpowers/specs/2026-05-30-company-logos-design.md`.

> 모든 명령은 `web/`에서 실행한다(`cd web`). 순수 함수(`web/lib/logo.ts`)는 단순하게 작성해 자명히 정확하게 한다.

---

## File Structure

- Create: `web/lib/logo.ts` — 순수 유틸(slugToDomain/logoUrl/initials/colorFromName).
- Create: `web/components/company/CompanyLogo.tsx` — 로고 `<img>` + 이니셜 폴백(client component).
- Modify: `web/components/job/JobCard.tsx` — 헤더에 CompanyLogo 삽입.
- Modify: `web/components/recommend/RecommendationCard.tsx` — 헤더에 CompanyLogo 삽입.
- Modify: `web/app/jobs/[id]/page.tsx` — 상세 헤더 h1 옆에 CompanyLogo(size 48) 삽입.

---

### Task 1: 로고 유틸 `web/lib/logo.ts`

**Files:** Create `web/lib/logo.ts`

- [ ] **Step 1: 구현**

```ts
// 회사 로고 유틸 (웹 전용). slug → 도메인 추론 + favicon URL + 이니셜/색 폴백.

// slug(ATS 토큰)가 실제 도메인 루트와 다른 경우만 보정. 대부분 {slug}.com 이 맞다.
const DOMAIN_OVERRIDES: Record<string, string> = {
  scaleai: "scale.com",
};

export function slugToDomain(slug: string | undefined | null): string {
  if (!slug) return "";
  const key = slug.trim().toLowerCase();
  if (!key) return "";
  return DOMAIN_OVERRIDES[key] ?? `${key}.com`;
}

// 로고 소스 교체 단일 지점: 추후 Logo.dev 등으로 바꾸려면 이 함수만 수정.
export function logoUrl(domain: string): string {
  if (!domain) return "";
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

const PALETTE = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#14b8a6", "#3b82f6", "#a855f7",
];

// 이름 해시 → 고정 팔레트 색(회사마다 일관된 배경색).
export function colorFromName(name: string): string {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

// display_name 첫 1~2 단어 이니셜(최대 2자, 대문자).
export function initials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음(신규 파일이 타입 통과).

- [ ] **Step 3: 동작 sanity(빠른 확인, 선택)**

가능하면 `cd web && npx tsx -e "import {slugToDomain,logoUrl,initials} from './lib/logo'; console.log(slugToDomain('stripe'), logoUrl(slugToDomain('scaleai')), initials('Social Finance'))"` 로 `stripe.com`, `https://icons.duckduckgo.com/ip3/scale.com.ico`, `SF` 출력 확인. (`tsx` 미설치면 생략 — Step 2 타입체크로 충분.)

- [ ] **Step 4: 커밋**

```bash
git add web/lib/logo.ts
git commit -m "feat(web): 회사 로고 유틸(slug→도메인, favicon URL, 이니셜 폴백)"
```

---

### Task 2: `CompanyLogo` 컴포넌트

**Files:** Create `web/components/company/CompanyLogo.tsx`

- [ ] **Step 1: 구현**

```tsx
"use client";

import { useState } from "react";

import { colorFromName, initials, logoUrl, slugToDomain } from "@/lib/logo";

export function CompanyLogo({
  slug,
  name,
  size = 36,
}: {
  slug?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const domain = slugToDomain(slug);
  const src = domain ? logoUrl(domain) : "";
  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ ...dim, backgroundColor: colorFromName(name) }}
        className="flex shrink-0 items-center justify-center rounded-md text-caption font-semibold text-white"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element  -- 외부 favicon, next/image 도메인 허용 회피
    <img
      src={src}
      alt={`${name} 로고`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={dim}
      className="shrink-0 rounded-md bg-muted object-contain"
    />
  );
}
```

> `"use client"` 필수(`useState`/`onError`). 서버 컴포넌트(JobCard 등)에서 이 클라이언트 컴포넌트를 렌더하는 건 정상. `no-img-element` lint 규칙이 있으면 위 disable 주석으로 처리(규칙 없으면 주석은 무해).

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add web/components/company/CompanyLogo.tsx
git commit -m "feat(web): CompanyLogo 컴포넌트(favicon + 이니셜 폴백)"
```

---

### Task 3: JobCard에 로고 삽입

**Files:** Modify `web/components/job/JobCard.tsx`

- [ ] **Step 1: import 추가**

기존 import 블록(VisaBadge import 근처)에 추가:
```tsx
import { CompanyLogo } from "@/components/company/CompanyLogo";
```

- [ ] **Step 2: 헤더에 로고 삽입**

현재 CardHeader 내부:
```tsx
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
              <CardTitle className="truncate hover:text-primary transition-colors">
                {job.title}
              </CardTitle>
            </Link>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {job.company.display_name}
              {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}
            </p>
          </div>
          <VisaBadge status={job.visa?.status} />
        </div>
```
를 다음으로 교체(로고 + 기존 텍스트 블록을 좌측 flex로 묶음):
```tsx
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} />
            <div className="min-w-0">
              <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
                <CardTitle className="truncate hover:text-primary transition-colors">
                  {job.title}
                </CardTitle>
              </Link>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {job.company.display_name}
                {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}
              </p>
            </div>
          </div>
          <VisaBadge status={job.visa?.status} />
        </div>
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add web/components/job/JobCard.tsx
git commit -m "feat(web): JobCard 에 회사 로고 표시"
```

---

### Task 4: RecommendationCard + 공고 상세에 로고 삽입

**Files:** Modify `web/components/recommend/RecommendationCard.tsx`, `web/app/jobs/[id]/page.tsx`

- [ ] **Step 1: RecommendationCard import + 헤더 수정**

import 추가:
```tsx
import { CompanyLogo } from "@/components/company/CompanyLogo";
```
CardHeader 내부의 `<div className="min-w-0">` 블록을 로고와 함께 flex로 감싼다. 현재:
```tsx
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-caption font-mono text-muted-foreground">#{rank}</span>
              <span className="rounded-md bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
                {Math.round(score.final_score * 100)}점
              </span>
            </div>
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
              <CardTitle className="mt-1 truncate hover:text-primary transition-colors">
                {job.title}
              </CardTitle>
            </Link>
            <p className="mt-1 text-body-sm text-muted-foreground">{meta.join(" · ")}</p>
          </div>
```
를:
```tsx
          <div className="flex min-w-0 items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-caption font-mono text-muted-foreground">#{rank}</span>
                <span className="rounded-md bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
                  {Math.round(score.final_score * 100)}점
                </span>
              </div>
              <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
                <CardTitle className="mt-1 truncate hover:text-primary transition-colors">
                  {job.title}
                </CardTitle>
              </Link>
              <p className="mt-1 text-body-sm text-muted-foreground">{meta.join(" · ")}</p>
            </div>
          </div>
```

- [ ] **Step 2: 공고 상세 헤더 수정** — `web/app/jobs/[id]/page.tsx`

import 추가(파일 상단 import 블록):
```tsx
import { CompanyLogo } from "@/components/company/CompanyLogo";
```
헤더의 제목 행:
```tsx
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-h1">{job.title}</h1>
          <VisaBadge status={job.visa?.status} />
        </div>
```
를:
```tsx
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} size={48} />
            <h1 className="text-h1">{job.title}</h1>
          </div>
          <VisaBadge status={job.visa?.status} />
        </div>
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add web/components/recommend/RecommendationCard.tsx "web/app/jobs/[id]/page.tsx"
git commit -m "feat(web): 추천 카드·공고 상세에 회사 로고 표시"
```

---

### Task 5: 라이브 비주얼 검증 (dev 스택 + Playwright)

**Files:** 없음(검증 전용, 커밋 없음)

- [ ] **Step 1: 빌드/린트 확인**

Run: `cd web && npx tsc --noEmit && npm run lint 2>/dev/null || true`
Expected: 타입 에러 없음. (lint 스크립트 있으면 통과.)

- [ ] **Step 2: dev 스택 기동**

백엔드(8081 또는 기존 포트)+web(3000/3001)이 떠 있어야 함. 기존 `./dev.sh` 또는 이미 실행 중인 스택 사용. Postgres(5433)에 라이브 공고 존재 확인.

- [ ] **Step 3: Playwright 비주얼 확인**

- `/search` 접속 → 공고 카드들에 회사 로고 표시 확인(stripe/databricks 등 favicon, 무명 회사 이니셜 폴백). 스크린샷.
- 의도적 실패 케이스(존재하지 않는 도메인 회사) → 이니셜 아바타 표시, 깨진 이미지 아이콘 없음 확인.
- 공고 상세 페이지 → h1 옆 48px 로고 확인.
- 레이아웃 시프트 없음(고정 크기) 확인.

- [ ] **Step 4: 결과 보고**

스크린샷 + 정상/폴백 동작 요약. 코드 변경 없으면 커밋 없음.

> 라이브 스택 미가동 시: Step 1 타입체크까지만 하고, 비주얼 검증은 머지 후/스택 가동 시점으로 표기.

---

## Self-Review

- **Spec coverage:** §4.1 logo.ts → Task 1. §4.2 CompanyLogo → Task 2. §4.3 JobCard → Task 3. §4.4 RecommendationCard+상세 → Task 4. §6 검증(tsc+라이브) → Task 1~5. 누락 없음.
- **Placeholder scan:** TBD/TODO 없음. 모든 코드 스텝에 실제 코드. DOMAIN_OVERRIDES는 실제 불일치(scaleai)만 시드, 확장 가능.
- **Type consistency:** `slugToDomain(slug?: string|null) -> string`, `logoUrl(domain: string) -> string`, `initials(name)`, `colorFromName(name)` (Task 1 정의) ↔ CompanyLogo(Task 2)에서 동일 시그니처로 호출. `CompanyLogo({slug?, name, size?})` props ↔ JobCard/RecommendationCard/상세(Task 3·4)에서 `slug={job.company.slug} name={job.company.display_name}` 전달. `JobCompany`는 `{slug, display_name}` 보유(타입 확인됨). next/image 미사용이라 config 변경 불요.
