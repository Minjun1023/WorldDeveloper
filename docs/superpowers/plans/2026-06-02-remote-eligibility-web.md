# 원격 적격 웹 (소프트포크 랜딩 + RemoteBadge + 트랙/미확인 토글) — Phase 3 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹이 Phase 2 백엔드의 viable 게이트/트랙/미확인 토글을 노출한다 — 첫 진입 소프트포크(이주/원격/둘다), 원격 적격 배지, `/search` 의 트랙 전환 + "미확인 공고 포함" 토글.

**Architecture:** 검색 상태는 URL 쿼리스트링이 single source of truth(`useUpdateQuery` 훅). 서버 컴포넌트(`/search`, 홈)가 `searchParams` 를 읽어 `fetchJobs({track, includeUnclear})` 로 백엔드에 전달하고, 클라이언트 토글 컴포넌트가 URL 을 갱신한다. 배지는 기존 `VisaBadge` 패턴(해당 상태만 렌더, 나머지 null)을 그대로 따른다.

**Tech Stack:** Next.js App Router (서버/클라이언트 컴포넌트), TypeScript, Tailwind. 작업 경로 `/Users/mac/WordDeveloper/WorldDeveloper/web`. 브랜치 `feat/remote-eligibility-data-axis`.

**관련 문서:** spec `docs/superpowers/specs/2026-06-01-korea-viability-remote-eligibility-design.md`(섹션 "소프트 포크 랜딩"), Phase2 plan `docs/superpowers/plans/2026-06-01-remote-eligibility-backend.md`.

**백엔드 계약 (Phase 2, 라이브 검증 완료):**
```
GET /api/v1/jobs?track={relocation|remote|(없음=둘다)}&include_unclear={true|false}
  기본(파라미터 없음): viable 만 (sponsors OR remote_eligibility IN worldwide/apac_ok)
  track=remote: worldwide/apac_ok 만 + 원격 티어 정렬(worldwide→apac_ok)
  track=relocation: visa sponsors 만
  include_unclear=true: unclear 도 노출
응답 item: { ..., "visa": {status, evidence}, "remote": {eligibility, evidence} }
응답 facets: { visa_status, is_remote, remote_eligibility }
  remote.eligibility ∈ worldwide|apac_ok|region_restricted|unclear|null(=onsite)
```

**테스트 환경 주의:** 이 웹 프로젝트에는 단위 테스트 러너가 없다(`package.json` scripts: dev/build/start/lint/typecheck). 따라서 각 태스크의 검증 게이트는 **`npm run typecheck` + `npm run lint`**, 마지막 태스크에서 **`npm run build` + Playwright 라이브 검증**(실행 중인 백엔드 8080 + 웹 3000 대상)이다. 이는 이전 웹 페이즈(랜딩/검색/헤더)의 검증 방식과 동일하다.

**빌드/검증 명령:**
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/web
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # 프로덕션 빌드(전체 타입+컴파일)
```

---

### Task 1: 데이터 레이어 — 타입 + API 쿼리 파라미터

`remote` 필드와 `track`/`includeUnclear` 쿼리를 데이터 레이어에 먼저 싣는다. UI 가 이 타입에 의존하므로 가장 먼저.

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/lib/api.ts`

- [ ] **Step 1: types.ts — RemoteEligibility/JobRemote 타입 + Job/JobDetail/Facets 필드 추가**

`web/lib/types.ts` 의 `VisaStatus` 선언(line 3) 아래에 추가:
```ts
export type RemoteEligibility =
  | "worldwide"
  | "apac_ok"
  | "region_restricted"
  | "unclear";
```

`JobVisa` 인터페이스(line 11-14) 아래에 추가:
```ts
export interface JobRemote {
  eligibility?: RemoteEligibility | null;
  evidence?: string[];
}
```

`Job` 인터페이스의 `visa?: JobVisa;`(line 33) 아래에 추가:
```ts
  remote?: JobRemote;
```

`JobDetail` 인터페이스의 `visa?: JobVisa;`(line 49) 아래에 추가:
```ts
  remote?: JobRemote;
```

`Facets` 인터페이스(line 53-56)에 필드 추가:
```ts
export interface Facets {
  visa_status?: Record<string, number>;
  is_remote?: Record<string, number>;
  remote_eligibility?: Record<string, number>;
}
```

- [ ] **Step 2: api.ts — JobQuery 에 track/includeUnclear + fetchJobs 에 파라미터 세팅**

`web/lib/api.ts` 의 `JobQuery` 인터페이스(line 36-46)에 두 필드 추가 — `sort?: string;` 아래:
```ts
export interface JobQuery {
  q?: string;
  visa?: string;
  location?: string;
  region?: string;
  remote?: boolean;
  sort?: string;
  discipline?: string;
  track?: string;
  includeUnclear?: boolean;
  page?: number;
  pageSize?: number;
}
```

`fetchJobs` 의 쿼리 세팅 블록에서 `if (query.discipline) ...`(line 60) 아래에 추가:
```ts
  if (query.track) url.searchParams.set("track", query.track);
  if (query.includeUnclear) url.searchParams.set("include_unclear", "true");
```

- [ ] **Step 3: 타입 체크**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/web && npm run typecheck`
Expected: 에러 없음(exit 0). 기존 코드가 새 옵셔널 필드를 안 써도 통과.

- [ ] **Step 4: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add web/lib/types.ts web/lib/api.ts
git commit -m "feat(web): remote eligibility types + track/include_unclear query params"
```

---

### Task 2: RemoteBadge 컴포넌트 + 카드/상세에 노출

`VisaBadge` 패턴(worldwide/apac_ok 만 렌더, 나머지 null)을 따른다. region_restricted/unclear/onsite 는 배지 없음 — 신호가 되는 것만 표시.

**Files:**
- Create: `web/components/job/RemoteBadge.tsx`
- Modify: `web/components/job/JobCard.tsx`
- Modify: `web/app/jobs/[id]/page.tsx`

- [ ] **Step 1: RemoteBadge.tsx 생성**

`web/components/job/RemoteBadge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";
import type { RemoteEligibility } from "@/lib/types";

// VisaBadge 와 동일 철학: 신호가 되는 값만 표시. region_restricted/unclear/onsite(null)는
// 배지를 렌더링하지 않는다(한국 거주자가 지원 가능한 worldwide/apac_ok 만 양성 신호).
const LABEL: Partial<Record<RemoteEligibility, string>> = {
  worldwide: "원격 가능",
  apac_ok: "아시아 원격",
};

export function RemoteBadge({ eligibility }: { eligibility?: RemoteEligibility | null }) {
  if (eligibility !== "worldwide" && eligibility !== "apac_ok") return null;

  return (
    <Badge
      variant="outline"
      className="shrink-0 border-primary/30 text-primary"
      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
    >
      {LABEL[eligibility]}
    </Badge>
  );
}
```

- [ ] **Step 2: JobCard 에 RemoteBadge 추가**

`web/components/job/JobCard.tsx` 의 import 에 추가(line 10 `import { VisaBadge } from "./VisaBadge";` 아래):
```tsx
import { RemoteBadge } from "./RemoteBadge";
```

`<VisaBadge status={job.visa?.status} />`(line 45)를 배지 묶음으로 교체:
```tsx
          <div className="flex shrink-0 flex-col items-end gap-1">
            <VisaBadge status={job.visa?.status} />
            <RemoteBadge eligibility={job.remote?.eligibility} />
          </div>
```
(둘 다 해당 없으면 각각 null → 빈 flex 컨테이너만 남고 레이아웃 영향 없음.)

- [ ] **Step 3: 공고 상세 페이지에 RemoteBadge 추가**

`web/app/jobs/[id]/page.tsx` 의 import 에 추가(line 9 `import { VisaBadge } ...` 아래):
```tsx
import { RemoteBadge } from "@/components/job/RemoteBadge";
```

`<VisaBadge status={job.visa?.status} />`(line 66)를 교체:
```tsx
          <div className="flex shrink-0 flex-col items-end gap-1">
            <VisaBadge status={job.visa?.status} />
            <RemoteBadge eligibility={job.remote?.eligibility} />
          </div>
```

- [ ] **Step 4: 타입 + 린트**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/web && npm run typecheck && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add web/components/job/RemoteBadge.tsx web/components/job/JobCard.tsx "web/app/jobs/[id]/page.tsx"
git commit -m "feat(web): RemoteBadge on job card + detail (worldwide/apac_ok only)"
```

---

### Task 3: /search 트랙 토글 + 미확인 토글 배선

`SearchFilters` 바에 트랙 전환(둘다/이주/원격)과 "미확인 공고 포함" 토글을 추가하고, `/search` 서버 컴포넌트가 `track`/`include_unclear` 를 읽어 `fetchJobs` 로 넘긴다.

**Files:**
- Modify: `web/components/search/SearchFilters.tsx`
- Modify: `web/app/search/page.tsx`

- [ ] **Step 1: SearchFilters 에 트랙 pills + 미확인 토글 추가**

`web/components/search/SearchFilters.tsx` 전체를 교체:
```tsx
"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const pillBase = "rounded-full border px-3 py-1 text-body-sm transition-colors";

function pillClass(active: boolean) {
  return cn(
    pillBase,
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-foreground hover:bg-accent",
  );
}

const TRACKS: { value: string | null; label: string }[] = [
  { value: null, label: "둘 다" },
  { value: "relocation", label: "이주(비자)" },
  { value: "remote", label: "원격" },
];

export function SearchFilters() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const track = searchParams.get("track");
  const remote = searchParams.get("remote") === "true";
  const includeUnclear = searchParams.get("include_unclear") === "true";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TRACKS.map((t) => {
        const active = t.value === track || (t.value === null && !track);
        return (
          <button
            key={t.label}
            type="button"
            onClick={() => update({ track: t.value })}
            className={pillClass(active)}
          >
            {t.label}
          </button>
        );
      })}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <button
        type="button"
        onClick={() => update({ remote: remote ? null : "true" })}
        className={pillClass(remote)}
      >
        원격만
      </button>

      <button
        type="button"
        onClick={() => update({ include_unclear: includeUnclear ? null : "true" })}
        className={pillClass(includeUnclear)}
      >
        미확인 공고 포함
      </button>
    </div>
  );
}
```

- [ ] **Step 2: /search 페이지가 track/include_unclear 읽어 전달**

`web/app/search/page.tsx` 의 searchParams 파싱부(line 23-30)에서 `discipline` 줄 아래에 추가:
```ts
  const discipline = str(searchParams.discipline);
  const track = str(searchParams.track);
  const includeUnclear = searchParams.include_unclear === "true";
```

`fetchJobs(...)` 호출(line 33)을 교체:
```ts
    fetchJobs({ q, visa, location, region, remote, sort, discipline, track, includeUnclear, page, pageSize: PAGE_SIZE }),
```

- [ ] **Step 3: 타입 + 린트**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/web && npm run typecheck && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 4: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add web/components/search/SearchFilters.tsx web/app/search/page.tsx
git commit -m "feat(web): search track toggle + include_unclear toggle wired to backend"
```

---

### Task 4: 홈 소프트포크 랜딩(TrackPicker) + 통계 의미 보정

첫 진입에서 3갈래(이주/원격/둘다)를 명시적으로 안내한다. 각 갈래는 `/search?track=...` 로 이동. 기본 게이트가 적용되면 홈의 "전체 공고" 통계가 viable(1,332)로 줄어드는데, 이 수치는 "전체 active(2,368)" 의미를 유지하도록 `include_unclear=true` 로 집계한다.

**Files:**
- Create: `web/components/home/TrackPicker.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: TrackPicker.tsx 생성**

`web/components/home/TrackPicker.tsx`:
```tsx
import Link from "next/link";

const TRACKS = [
  {
    href: "/search?track=relocation",
    emoji: "✈️",
    title: "이주하고 싶어요",
    desc: "비자 스폰서를 받아 현지에서 근무",
  },
  {
    href: "/search?track=remote",
    emoji: "🏠",
    title: "한국에 살면서 원격",
    desc: "한국 거주자가 지원 가능한 원격 공고",
  },
  {
    href: "/search",
    emoji: "🧭",
    title: "둘 다 / 아직 모르겠어요",
    desc: "지원 가능한 공고 전체 보기",
  },
];

export function TrackPicker() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TRACKS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40"
        >
          <div className="text-2xl">{t.emoji}</div>
          <div className="mt-2 font-semibold text-foreground">{t.title}</div>
          <div className="mt-1 text-body-sm text-muted-foreground">{t.desc}</div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 홈에 TrackPicker 섹션 추가 + 전체 통계 보정**

`web/app/page.tsx` 의 import 에 추가(line 4 `import { Hero } ...` 아래):
```tsx
import { TrackPicker } from "@/components/home/TrackPicker";
```

전체 공고 수치가 "active 전체" 의미를 유지하도록, `allRes` fetch(line 14)를 교체:
```ts
    fetchJobs({ pageSize: 1, includeUnclear: true }),
```

`<Hero stats={stats} />`(line 38) 아래에 TrackPicker 섹션 삽입:
```tsx
      <Hero stats={stats} />

      <section>
        <h2 className="mb-3 text-center text-body-sm font-medium text-muted-foreground">
          어떤 길을 찾고 계세요?
        </h2>
        <TrackPicker />
      </section>
```

- [ ] **Step 3: 타입 + 린트 + 빌드**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/web && npm run typecheck && npm run lint && npm run build`
Expected: 셋 다 성공(빌드 BUILD 완료).

- [ ] **Step 4: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add web/components/home/TrackPicker.tsx web/app/page.tsx
git commit -m "feat(web): soft-fork landing (relocation/remote/both) + total stat keeps full count"
```

---

### Task 5: Playwright 라이브 검증

단위 러너가 없으므로 실행 중인 스택(백엔드 8080 + 웹 3000)에 대해 Playwright 로 end-to-end 확인한다. 백엔드는 Phase 2 검증 때 backfill 로 `remote_eligibility` 가 채워진 상태여야 한다(track=remote 가 25건). 비어 있으면 `cd ai && .venv/bin/python -m scripts.backfill_remote_eligibility` 재실행.

**Files:** (코드 변경 없음 — 검증 전용. 회귀 발견 시 해당 태스크로 돌아가 수정)

- [ ] **Step 1: 웹/백엔드 기동 확인**

Run:
```bash
curl -s -o /dev/null -w 'web %{http_code}\n' http://localhost:3000
curl -s -o /dev/null -w 'be  %{http_code}\n' 'http://localhost:8080/api/v1/jobs?page_size=1'
```
Expected: 둘 다 200. 아니면 `cd web && npm run dev`, `cd backend && ./gradlew bootRun` 로 기동.

- [ ] **Step 2: 홈 소프트포크 노출 확인 (Playwright)**

`mcp__playwright__browser_navigate` → `http://localhost:3000`, 그다음 `mcp__playwright__browser_snapshot`.
Expected: "이주하고 싶어요", "한국에 살면서 원격", "둘 다 / 아직 모르겠어요" 3개 카드가 보인다.

- [ ] **Step 3: 원격 트랙 진입 + RemoteBadge 확인**

`mcp__playwright__browser_navigate` → `http://localhost:3000/search?track=remote`, `mcp__playwright__browser_snapshot`.
Expected: 공고 수 표기가 25건(또는 백엔드 현재 worldwide+apac_ok 수)과 일치. 카드에 "원격 가능"/"아시아 원격" 배지가 보인다. "스폰서 불가" 만 있고 원격 배지 없는 카드는 이 트랙에 없어야 한다.

- [ ] **Step 4: 기본 게이트 vs 미확인 토글 카운트 대조**

`mcp__playwright__browser_navigate` → `http://localhost:3000/search`, snapshot 에서 "N건" 읽기(기본 viable).
그다음 `http://localhost:3000/search?include_unclear=true`, snapshot 에서 "N건" 읽기.
Expected: 미확인 포함 쪽이 더 큼(기본 viable < 전체). 백엔드 직접 대조:
```bash
echo "viable :" $(curl -s 'http://localhost:8080/api/v1/jobs?page_size=1' | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")
echo "unclear:" $(curl -s 'http://localhost:8080/api/v1/jobs?page_size=1&include_unclear=true' | python3 -c "import sys,json;print(json.load(sys.stdin)['total'])")
```
화면 수치와 API 수치가 일치해야 한다.

- [ ] **Step 5: 이주 트랙 + 트랙 토글 동작 확인**

`http://localhost:3000/search?track=relocation` snapshot.
Expected: 모든 카드에 "스폰서 가능" 배지, 공고 수 = 백엔드 `track=relocation` total(스폰서 수)과 일치. SearchFilters 바에서 "이주(비자)" pill 이 활성(primary) 상태.

- [ ] **Step 6: 공고 상세 RemoteBadge 확인**

원격 트랙 첫 카드 제목 클릭(또는 `browser_navigate` 로 원격 공고 상세 URL) → snapshot.
Expected: 상세 헤더에 "원격 가능"/"아시아 원격" 배지가 visa 배지와 함께 보인다.

- [ ] **Step 7: 콘솔 에러 점검**

`mcp__playwright__browser_console_messages` 로 위 페이지들에서 치명적 에러(빨강) 없음 확인.
Expected: hydration/타입 관련 에러 없음.

- [ ] **Step 8: 검증 결과 기록 (커밋 불필요)**

발견된 회귀가 있으면 해당 Task(2/3/4)로 돌아가 수정 후 재검증. 전부 통과면 Phase 3 완료.

---

## Phase 3 완료 기준

- 홈 첫 진입에 소프트포크 3갈래(이주/원격/둘다)가 보이고, 각 갈래가 `/search?track=...` 로 이동한다.
- `/search` 에서 트랙 전환(둘다/이주/원격) + "미확인 공고 포함" 토글이 동작하고 URL 쿼리에 반영된다.
- 공고 카드/상세에 `RemoteBadge`(worldwide=원격 가능, apac_ok=아시아 원격)가 표시되고, region_restricted/unclear/onsite 는 배지가 없다.
- 화면 공고 수가 백엔드 게이트(viable/track/include_unclear) 결과와 일치한다.
- `typecheck`/`lint`/`build` 그린, Playwright 라이브 검증 통과.

## 주의 / 한계

- **트랙 전환 위치:** spec 은 "헤더에서 트랙 전환"을 제안하나, 본 계획은 범위를 줄여 `/search` 필터바에 둔다(홈 소프트포크 + 검색 토글로 핵심 UX 충족). 전역 헤더 트랙 표시는 후속(SiteNav 확장).
- **facets 미사용:** 응답 `facets.remote_eligibility` 는 타입에만 추가하고 UI 시각화(분포 막대 등)는 후속. 현재는 카운트/배지로 충분.
- **데이터 의존:** `remote_eligibility` 는 백엔드 부팅 후 ETL(또는 backfill)이 한 번 돌아야 채워진다. 비어 있으면 track=remote 가 0건으로 보일 수 있음 — 검증 전 backfill 확인.
- **단위 테스트 부재:** 웹은 러너가 없어 typecheck/lint/build + Playwright 가 검증 게이트다. 후속에서 Vitest+RTL 도입 시 SearchFilters/배지 단위 테스트 추가 권장.

## 다음 단계 (Phase 4 후보, 별도 계획)

- 전역 헤더 트랙 표시/전환(SiteNav) + 트랙 상태 영속화(쿠키/localStorage).
- `facets.remote_eligibility` 시각화 + 원격 신호 보강(unclear 축소: 타임존/권역 키워드, EOR 표기 등).
- 추천(`/recommend`) 경로에 remote_eligibility 반영.
