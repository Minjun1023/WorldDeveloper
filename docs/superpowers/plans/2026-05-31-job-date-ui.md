# 공고 날짜 UI 개선 구현 플랜 (상시채용 + 게시 신선도)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 카드·상세에서 게시일을 상대 신선도로 표기하고, 마감일이 없으면 `상시채용`으로 표기하며, 의미 없는 raw `job.id` 노출을 제거한다.

**Architecture:** 웹 전용. 순수 함수 모듈 `web/lib/jobDates.ts`(`postedLabel`, `deadlineLabel`)를 만들어 JobCard와 공고 상세 페이지에서 사용. 백엔드/DB/커넥터 변경 없음.

**Tech Stack:** Next.js 14 / React / TypeScript / Tailwind. 검증은 `npx tsc --noEmit` + 라이브 비주얼(웹에 테스트 러너 없음, 기존 관행).

설계 전문: `docs/superpowers/specs/2026-05-31-job-date-ui-design.md`.

> 명령은 `web/`에서 실행(`cd web`). `Job` 타입은 `posted_at?`·`closes_at?`를 가짐(상세 페이지가 이미 사용 — Task 시작 시 `web/lib/types.ts`에서 확인).

---

## File Structure

- Create: `web/lib/jobDates.ts` — `postedLabel`, `deadlineLabel`(+ `DeadlineLabel` 타입).
- Modify: `web/components/job/JobCard.tsx` — 게시 상대표기 + 상시채용/마감 + job.id 제거(`formatDate` 제거).
- Modify: `web/app/jobs/[id]/page.tsx` — 동일 헬퍼 사용 + job.id 제거(inline `closes`/`daysLeft` 제거).

---

### Task 1: `web/lib/jobDates.ts` 유틸

**Files:** Create `web/lib/jobDates.ts`

- [ ] **Step 1: 구현**

```ts
// 공고 날짜 표기 유틸 (웹 전용, 순수 함수).

function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 게시일 상대 표기: 오늘/어제/N일 전(14일 미만), 그 외엔 날짜.
export function postedLabel(posted_at?: string): string | null {
  const d = parseDate(posted_at);
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "오늘 게시";
  if (days === 1) return "어제 게시";
  if (days < 14) return `${days}일 전 게시`;
  return `${d.toLocaleDateString("ko-KR")} 게시`;
}

export interface DeadlineLabel {
  text: string;
  urgent: boolean;
}

// 마감일 표기: closes_at 있으면 "마감 날짜 (D-N)", 없으면 "상시채용".
export function deadlineLabel(closes_at?: string): DeadlineLabel {
  const d = parseDate(closes_at);
  if (!d) return { text: "상시채용", urgent: false };
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString("ko-KR");
  if (daysLeft < 0) return { text: `마감 ${date} (마감)`, urgent: false };
  return { text: `마감 ${date} (D-${daysLeft})`, urgent: daysLeft <= 7 };
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: sanity (선택)**

`cd web && npx tsx -e "import {postedLabel,deadlineLabel} from './lib/jobDates'; console.log(postedLabel(new Date().toISOString()), JSON.stringify(deadlineLabel(undefined)), JSON.stringify(deadlineLabel(new Date(Date.now()+3*86400000).toISOString())))"`
Expected 대략: `오늘 게시 {"text":"상시채용","urgent":false} {"text":"마감 ... (D-3)","urgent":true}`. (`tsx` 없으면 생략 — Step 2로 충분.)

- [ ] **Step 4: 커밋**

```bash
git add web/lib/jobDates.ts
git commit -m "feat(web): 공고 날짜 표기 유틸(postedLabel, deadlineLabel=상시채용 폴백)"
```

---

### Task 2: JobCard에 적용 + job.id 제거

**Files:** Modify `web/components/job/JobCard.tsx`

- [ ] **Step 1: import 추가 + formatDate 제거**

상단 import에 추가:
```tsx
import { postedLabel, deadlineLabel } from "@/lib/jobDates";
```
다음 `formatDate` 함수 정의를 **삭제**(교체로 미사용됨):
```tsx
function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ko-KR");
}
```

- [ ] **Step 2: 컴포넌트 본문 변수 교체**

`const posted = formatDate(job.posted_at);` 를:
```tsx
  const posted = postedLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
```

- [ ] **Step 3: 메타 행 교체 (job.id 제거)**

현재:
```tsx
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted}</span>}
          <span className="font-mono">{job.id}</span>
        </div>
```
교체:
```tsx
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted}</span>}
          <span className={deadline.urgent ? "text-foreground font-medium" : undefined}>
            {deadline.text}
          </span>
        </div>
```

- [ ] **Step 4: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음. (만약 `job.closes_at` 타입 에러면 `web/lib/types.ts`의 `Job`에 `closes_at?: string`가 있는지 확인 — 상세 페이지가 이미 쓰므로 있을 것. 없으면 추가.)

- [ ] **Step 5: 커밋**

```bash
git add web/components/job/JobCard.tsx
git commit -m "feat(web): JobCard 게시일 상대표기 + 상시채용/마감 + raw job.id 숨김"
```

---

### Task 3: 공고 상세 페이지에 적용 + job.id 제거

**Files:** Modify `web/app/jobs/[id]/page.tsx`

- [ ] **Step 1: import 추가**

상단 import 블록에:
```tsx
import { postedLabel, deadlineLabel } from "@/lib/jobDates";
```

- [ ] **Step 2: 날짜 변수 교체**

현재:
```tsx
  const posted = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString("ko-KR")
    : null;
  const closes = job.closes_at ? new Date(job.closes_at) : null;
  const daysLeft = closes
    ? Math.ceil((closes.getTime() - Date.now()) / 86_400_000)
    : null;
```
교체:
```tsx
  const posted = postedLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
```

- [ ] **Step 3: 메타 행 교체 (job.id 제거)**

현재:
```tsx
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted} 게시</span>}
          {closes && daysLeft !== null && (
            <span className={daysLeft <= 7 ? "text-foreground font-medium" : undefined}>
              마감 {closes.toLocaleDateString("ko-KR")}
              {daysLeft >= 0 ? ` (D-${daysLeft})` : " (마감)"}
            </span>
          )}
          <span className="font-mono">{job.id}</span>
```
교체 (`postedLabel`이 이미 "게시"를 포함하므로 ` 게시` 안 붙임):
```tsx
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted}</span>}
          <span className={deadline.urgent ? "text-foreground font-medium" : undefined}>
            {deadline.text}
          </span>
```

- [ ] **Step 4: 타입체크 + 잔여 미사용 확인**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음. (`closes`/`daysLeft` 제거됨 — 다른 곳에서 안 쓰는지 확인; 본문 다른 위치에서 `closes`를 참조하면 함께 정리.)

- [ ] **Step 5: 커밋**

```bash
git add "web/app/jobs/[id]/page.tsx"
git commit -m "feat(web): 공고 상세 게시일 상대표기 + 상시채용/마감 통일 + raw job.id 숨김"
```

---

### Task 4: 라이브 비주얼 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 빌드/타입 확인** — `cd web && npx tsc --noEmit` → 에러 없음.

- [ ] **Step 2: dev 스택**

worktree web을 별도 포트로 기동(사용자 :3000 비간섭): `cd web && PORT=3001 BACKEND_URL=http://localhost:8080 npm run dev`. 백엔드(:8080)·Postgres(:5433) 가동 확인.

- [ ] **Step 3: Playwright 확인**

- `/search`: 공고 카드에 (a) 게시일 상대표기(`N일 전 게시` 등), (b) 마감일 없는 공고 → `상시채용`, (c) raw `job.id`(arbeitnow:...) 미표시 확인.
- 공고 상세(arbeitnow 공고, 예 `/jobs/arbeitnow%3Aforward-deployed-engineer-berlin-26761`): `상시채용` + 상대 게시일 + job.id 없음.
- (있으면) greenhouse 마감일 보유 공고 → `마감 D-N` 유지.
- DOM eval로 메타 텍스트에 "arbeitnow:" 미포함, "상시채용"/"게시" 포함 확인. 스크린샷.

- [ ] **Step 4: 보고** — 스크린샷 + 동작 요약. 검증 전용, 커밋 없음.

> 라이브 스택 미가동 시: Step 1 타입체크까지만 하고 비주얼은 머지 후로 표기.

---

## Self-Review

- **Spec coverage:** §3.1 jobDates.ts → Task 1. §3.2 JobCard(상대게시·상시채용·job.id제거) → Task 2. §3.3 상세 → Task 3. §5 검증 → Task 1~4. 누락 없음. #2(마감일 추출)는 스펙대로 범위 밖(코드 없음).
- **Placeholder scan:** TBD/TODO 없음. 모든 스텝에 실제 코드/정확한 교체 블록.
- **Type consistency:** `postedLabel(posted_at?: string) -> string | null`, `deadlineLabel(closes_at?: string) -> DeadlineLabel{text,urgent}` (Task 1 정의) ↔ Task 2·3에서 `postedLabel(job.posted_at)`/`deadlineLabel(job.closes_at)`로 호출, `deadline.text`/`deadline.urgent` 사용. `Job`에 `posted_at?`·`closes_at?` 존재(상세 페이지 기사용; Task 2/4에서 확인). raw `job.id` span은 카드·상세 모두 제거.
