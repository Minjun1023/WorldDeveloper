# 프로필 페이지 재디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지 공통 쉘(좌측 사이드바)을 만들고, 그 안의 프로필 탭을 "리치 입력 폼 + 실시간 추천 미리보기" 2단 레이아웃으로 재디자인한다.

**Architecture:** 공유 `ProfileForm`(onboarding/recommend/auth가 사용)은 건드리지 않고, 프로필 전용 컴포넌트를 새로 만든다. 작은 재사용 프리미티브(`TagInput`, `Segmented`)를 만들고, `ProfileFields`(편집)와 `ProfilePreview`(읽기/매칭수)가 이를 조합하며, `ProfileEditor`가 상태를 보유해 둘을 잇는다. 마이페이지 쉘은 `me/layout.tsx` + `MeSidebar`로 구현한다. 백엔드/타입/API 라우트 변경 없음.

**Tech Stack:** Next.js(App Router, RSC) · React client components · Tailwind(디자인 토큰 `--score-*`, `cn`) · lucide-react · Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-06-10-profile-page-redesign-design.md`

**공통 명령:**
- 테스트: `cd web && npx vitest run <파일>` (전체: `npm test`)
- 타입체크: `cd web && npm run typecheck`

---

### Task 1: TagInput 프리미티브 (칩 입력)

기술 스택·선호 지역에 쓰는 재사용 칩 입력. 내부 모델은 `string[]`.

**Files:**
- Create: `web/components/ui/tag-input.tsx`
- Test: `web/components/ui/tag-input.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/ui/tag-input.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagInput } from "@/components/ui/tag-input";

describe("TagInput", () => {
  it("adds a trimmed tag on Enter and calls onChange", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("기술 스택"), "go{Enter}");
    expect(onChange).toHaveBeenCalledWith(["go"]);
  });

  it("ignores duplicates", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={["go"]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("기술 스택"), "go{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when its ✕ is clicked", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={["go", "rust"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "go 제거" }));
    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/ui/tag-input.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/tag-input`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/ui/tag-input.tsx
"use client";

import { useState } from "react";

export function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    setDraft("");
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-body-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption"
          >
            {tag}
            <button
              type="button"
              aria-label={`${tag} 제거`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent px-1 text-body-sm focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/ui/tag-input.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/ui/tag-input.tsx web/components/ui/tag-input.test.tsx
git commit -m "feat(web): add TagInput chip-input primitive"
```

---

### Task 2: Segmented 프리미티브 (세그먼트 컨트롤)

시니어리티·원격선호 선택용. 단일 값 토글 버튼 행.

**Files:**
- Create: `web/components/ui/segmented.tsx`
- Test: `web/components/ui/segmented.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/ui/segmented.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Segmented } from "@/components/ui/segmented";

const OPTS = [
  { value: "any", label: "상관없음" },
  { value: "remote", label: "원격" },
  { value: "onsite", label: "이주" },
];

describe("Segmented", () => {
  it("marks the selected option with aria-pressed", () => {
    render(<Segmented label="원격" options={OPTS} value="remote" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "원격" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "이주" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked value", async () => {
    const onChange = vi.fn();
    render(<Segmented label="원격" options={OPTS} value="any" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "이주" }));
    expect(onChange).toHaveBeenCalledWith("onsite");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/ui/segmented.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/segmented`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/ui/segmented.tsx
"use client";

import { cn } from "@/lib/utils";

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-body-sm font-medium">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex flex-wrap gap-0.5 rounded-md border border-border p-0.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded px-3 py-1 text-body-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/ui/segmented.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/ui/segmented.tsx web/components/ui/segmented.test.tsx
git commit -m "feat(web): add Segmented control primitive"
```

---

### Task 3: ProfileFields (리치 입력 폼 + 완성도 바)

프로필 전용 controlled 폼. `value`/`onChange`로 상위가 상태를 소유. 완성도는 사용자가 채우는 5개(기술·연차·지역·연봉·bio)만 카운트 — 시니어리티·원격선호는 기본값이 있어 제외.

**Files:**
- Create: `web/components/profile/ProfileFields.tsx`
- Test: `web/components/profile/ProfileFields.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/profile/ProfileFields.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileFields } from "@/components/profile/ProfileFields";
import type { RecommendProfile } from "@/lib/types";

const base: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

describe("ProfileFields", () => {
  it("shows completeness as filled/5", () => {
    render(
      <ProfileFields
        value={{ ...base, skills: ["go"], bio: "hi" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("emits seniority change via Segmented", async () => {
    const onChange = vi.fn();
    render(<ProfileFields value={base} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "junior" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ seniority: "junior" }),
    );
  });

  it("emits bio change", async () => {
    const onChange = vi.fn();
    render(<ProfileFields value={base} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/자기소개/), "x");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bio: "x" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/profile/ProfileFields.test.tsx`
Expected: FAIL — cannot resolve `@/components/profile/ProfileFields`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/profile/ProfileFields.tsx
"use client";

import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TagInput } from "@/components/ui/tag-input";
import type { RecommendProfile } from "@/lib/types";

const SENIORITY = ["junior", "mid", "senior", "staff", "principal"].map((v) => ({
  value: v,
  label: v,
}));
const REMOTE = [
  { value: "any", label: "상관없음" },
  { value: "remote", label: "원격" },
  { value: "onsite", label: "이주" },
];
const SALARY_MAX = 250000;

function completeness(p: RecommendProfile): number {
  let n = 0;
  if (p.skills.length) n++;
  if (p.years_experience != null) n++;
  if ((p.preferred_locations?.length ?? 0) > 0) n++;
  if (p.desired_salary_usd != null) n++;
  if (p.bio?.trim()) n++;
  return n;
}

export function ProfileFields({
  value,
  onChange,
}: {
  value: RecommendProfile;
  onChange: (next: RecommendProfile) => void;
}) {
  const set = (patch: Partial<RecommendProfile>) => onChange({ ...value, ...patch });
  const filled = completeness(value);
  const salary = value.desired_salary_usd ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between text-caption text-muted-foreground">
          <span>프로필 완성도</span>
          <span className="tabular-nums">{filled} / 5</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary"
            style={{ width: `${(filled / 5) * 100}%` }}
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          기술 · 경력
        </legend>
        <TagInput
          id="skills"
          label="기술 스택"
          value={value.skills}
          onChange={(skills) => set({ skills })}
          placeholder="React, Go… Enter로 추가"
        />
        <Segmented
          label="시니어리티"
          options={SENIORITY}
          value={value.seniority}
          onChange={(seniority) => set({ seniority })}
        />
        <label className="block space-y-1.5">
          <span className="text-body-sm font-medium">연차 (선택)</span>
          <Input
            type="number"
            value={value.years_experience ?? ""}
            onChange={(e) =>
              set({ years_experience: e.target.value ? Number(e.target.value) : undefined })
            }
            className="font-mono"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-body-sm font-medium">
            자기소개{" "}
            <span className="font-normal text-muted-foreground">(의미 매칭에 사용)</span>
          </span>
          <textarea
            value={value.bio ?? ""}
            onChange={(e) => set({ bio: e.target.value })}
            rows={3}
            placeholder="한두 문장으로 본인을 소개해 주세요."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <legend className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          선호 근무조건
        </legend>
        <TagInput
          id="locations"
          label="선호 지역"
          value={value.preferred_locations ?? []}
          onChange={(preferred_locations) => set({ preferred_locations })}
          placeholder="Berlin, Amsterdam…"
        />
        <Segmented
          label="원격 / 이주"
          options={REMOTE}
          value={value.remote_preference ?? "any"}
          onChange={(remote_preference) => set({ remote_preference })}
        />
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-body-sm font-medium">
            희망 연봉
            <span className="tabular-nums text-primary">
              {salary ? `$${Math.round(salary / 1000)}k` : "미설정"}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={SALARY_MAX}
            step={5000}
            value={salary}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ desired_salary_usd: v === 0 ? undefined : v });
            }}
            aria-label="희망 연봉"
            className="w-full accent-primary"
          />
        </label>
        <p className="text-caption text-muted-foreground">🛡 비자 스폰서십은 기본 포함돼요.</p>
      </fieldset>

      <details className="rounded-lg border border-border bg-surface px-5 py-3">
        <summary className="cursor-pointer text-body-sm text-muted-foreground">고급</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">추천 개수 (top_k)</span>
            <Input
              type="number"
              value={value.top_k ?? ""}
              onChange={(e) => set({ top_k: e.target.value ? Number(e.target.value) : undefined })}
              className="font-mono"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">회사당 최대 (max_per_company)</span>
            <Input
              type="number"
              value={value.max_per_company ?? ""}
              onChange={(e) =>
                set({ max_per_company: e.target.value ? Number(e.target.value) : undefined })
              }
              className="font-mono"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/profile/ProfileFields.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/profile/ProfileFields.tsx web/components/profile/ProfileFields.test.tsx
git commit -m "feat(web): add ProfileFields rich form with completeness meter"
```

---

### Task 4: ProfilePreview (6차원 매핑 + 온디맨드 매칭수)

우측 sticky 미리보기. 6차원 체크리스트는 `profile` prop으로 즉시 계산(무호출). 매칭수는 마운트 1회 + "갱신" 클릭에서만 `POST /api/recommend` 호출 → `total_candidates` 표시. prop 변경으로는 재호출하지 않는다(최신 값은 ref로 읽음).

**Files:**
- Create: `web/components/profile/ProfilePreview.tsx`
- Test: `web/components/profile/ProfilePreview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/profile/ProfilePreview.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfilePreview } from "@/components/profile/ProfilePreview";
import type { RecommendProfile } from "@/lib/types";

const base: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

function mockRecommend(total: number) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ total_candidates: total, returned: 0, recommendations: [] }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfilePreview", () => {
  it("fetches the match count once on mount and shows total_candidates", async () => {
    const f = mockRecommend(128);
    vi.stubGlobal("fetch", f);
    render(<ProfilePreview profile={base} />);
    expect(await screen.findByText("128")).toBeInTheDocument();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refetches only on 갱신 click, not on prop change", async () => {
    const f = mockRecommend(50);
    vi.stubGlobal("fetch", f);
    const { rerender } = render(<ProfilePreview profile={base} />);
    await screen.findByText("50");
    rerender(<ProfilePreview profile={{ ...base, skills: ["go"] }} />);
    expect(f).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "갱신 ↻" }));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("marks unfilled dimensions for an empty profile", async () => {
    vi.stubGlobal("fetch", mockRecommend(0));
    render(<ProfilePreview profile={base} />);
    expect(screen.getAllByText(/→ 미입력/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/profile/ProfilePreview.test.tsx`
Expected: FAIL — cannot resolve `@/components/profile/ProfilePreview`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/profile/ProfilePreview.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecommendProfile, RecommendResponse } from "@/lib/types";

const DIMS = [
  { key: "stack", label: "기술 스택", color: "var(--score-stack)" },
  { key: "seniority", label: "시니어리티", color: "var(--score-seniority)" },
  { key: "location", label: "선호 지역", color: "var(--score-location)" },
  { key: "visa", label: "비자", color: "var(--score-visa)" },
  { key: "salary", label: "연봉", color: "var(--score-salary)" },
  { key: "semantic", label: "의미 매칭", color: "var(--score-semantic)" },
] as const;

function dimState(p: RecommendProfile, key: string): { active: boolean; note: string } {
  switch (key) {
    case "stack":
      return {
        active: p.skills.length > 0,
        note: p.skills.length
          ? `${p.skills[0]}${p.skills.length > 1 ? ` +${p.skills.length - 1}` : ""}`
          : "미입력",
      };
    case "seniority":
      return { active: true, note: p.seniority };
    case "location": {
      const n = p.preferred_locations?.length ?? 0;
      return { active: n > 0, note: n ? `${n}곳` : "미입력" };
    }
    case "visa":
      return { active: true, note: "필요(기본)" };
    case "salary":
      return {
        active: p.desired_salary_usd != null,
        note: p.desired_salary_usd != null ? `$${Math.round(p.desired_salary_usd / 1000)}k` : "미입력",
      };
    case "semantic":
      return { active: !!p.bio?.trim(), note: p.bio?.trim() ? "자기소개 반영" : "미입력" };
    default:
      return { active: false, note: "" };
  }
}

export function ProfilePreview({ profile }: { profile: RecommendProfile }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profileRef.current),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as RecommendResponse;
      setCount(data.total_candidates ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // 마운트 시 1회만 호출 — 입력마다 호출하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky top-20 space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="border-b border-primary/15 pb-4 text-center">
        {loading ? (
          <p className="text-body-sm text-muted-foreground">계산 중…</p>
        ) : error ? (
          <p className="text-body-sm text-muted-foreground">불러올 수 없어요.</p>
        ) : (
          <p className="text-3xl font-extrabold tabular-nums text-primary">{count ?? "—"}</p>
        )}
        <p className="text-caption text-muted-foreground">개 공고가 지금 프로필과 매칭</p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="mt-2">
          갱신 ↻
        </Button>
      </div>

      <div>
        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          6차원 반영
        </p>
        <ul className="space-y-1.5 text-body-sm">
          {DIMS.map((d) => {
            const s = dimState(profile, d.key);
            return (
              <li key={d.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("h-2 w-2 shrink-0 rounded-full", s.active ? "" : "bg-muted")}
                  style={s.active ? { backgroundColor: d.color } : undefined}
                />
                <span className={s.active ? "" : "text-muted-foreground"}>{d.label}</span>
                <span className="ml-auto text-caption text-muted-foreground">
                  {s.active ? s.note : `→ ${s.note}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/profile/ProfilePreview.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/profile/ProfilePreview.tsx web/components/profile/ProfilePreview.test.tsx
git commit -m "feat(web): add ProfilePreview with 6-dim mapping + on-demand match count"
```

---

### Task 5: ProfileEditor 재작성 (상태 보유 + 2단 조립)

`GET /api/me/profile`로 로드 → `ProfileFields`(편집) + `ProfilePreview`(읽기) + 저장(`PUT /api/me/profile`). dirty/saved/error 표시.

**Files:**
- Modify (재작성): `web/components/profile/ProfileEditor.tsx`
- Test: `web/components/profile/ProfileEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/profile/ProfileEditor.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileEditor } from "@/components/profile/ProfileEditor";

function routeFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me/profile" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === "/api/me/profile") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
    }
    if (url === "/api/recommend") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total_candidates: 10, returned: 0, recommendations: [] }),
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfileEditor", () => {
  it("loads the form then saves via PUT /api/me/profile", async () => {
    const f = routeFetch();
    vi.stubGlobal("fetch", f);
    render(<ProfileEditor />);

    await screen.findByLabelText("기술 스택"); // 로드 완료 후 폼 렌더
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    const putCall = f.mock.calls.find(
      (c) => c[0] === "/api/me/profile" && (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    expect(await screen.findByText("저장됐어요.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/profile/ProfileEditor.test.tsx`
Expected: FAIL — old `ProfileEditor` has no "기술 스택" label / renders `ProfileForm`.

- [ ] **Step 3: Rewrite the implementation**

```tsx
// web/components/profile/ProfileEditor.tsx
"use client";

import { useEffect, useState } from "react";

import { ProfileFields } from "@/components/profile/ProfileFields";
import { ProfilePreview } from "@/components/profile/ProfilePreview";
import { Button } from "@/components/ui/button";
import type { RecommendProfile } from "@/lib/types";

const EMPTY: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

export function ProfileEditor() {
  const [profile, setProfile] = useState<RecommendProfile>(EMPTY);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.exists && d.profile) setProfile({ ...EMPTY, ...d.profile });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function update(next: RecommendProfile) {
    setProfile(next);
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
      setSaved(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ProfileFields value={profile} onChange={update} />
      <div className="space-y-3">
        <ProfilePreview profile={profile} />
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "저장 중…" : "저장"}
        </Button>
        {dirty && !saved && (
          <p className="text-center text-caption text-muted-foreground">변경사항 있음</p>
        )}
        {saved && <p className="text-center text-body-sm text-success">저장됐어요.</p>}
        {error && <p className="text-center text-body-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/profile/ProfileEditor.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/components/profile/ProfileEditor.tsx web/components/profile/ProfileEditor.test.tsx
git commit -m "feat(web): rewrite ProfileEditor as form + live preview, lifted state"
```

---

### Task 6: MeSidebar (마이페이지 공통 내비)

`usePathname()`으로 active 표시. 4개 기존 라우트만. lg 이상 세로 사이드바, 그 미만 가로 스크롤 탭.

**Files:**
- Create: `web/components/me/MeSidebar.tsx`
- Test: `web/components/me/MeSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/components/me/MeSidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/me/profile" }));

import { MeSidebar } from "@/components/me/MeSidebar";

describe("MeSidebar", () => {
  it("renders 4 items and marks the active route", () => {
    render(<MeSidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /프로필/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /저장한 공고/ })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run components/me/MeSidebar.test.tsx`
Expected: FAIL — cannot resolve `@/components/me/MeSidebar`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/me/MeSidebar.tsx
"use client";

import { Bookmark, FileText, ListChecks, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/me/profile", label: "프로필", icon: User },
  { href: "/me/saved", label: "저장한 공고", icon: Bookmark },
  { href: "/me/applications", label: "지원 현황", icon: ListChecks },
  { href: "/me/coach", label: "이력서 코치", icon: FileText },
];

export function MeSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="내 페이지" className="lg:w-52 lg:shrink-0">
      <p className="mb-2 hidden px-3 text-caption font-medium uppercase tracking-wide text-muted-foreground lg:block">
        내 페이지
      </p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-body-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run components/me/MeSidebar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/components/me/MeSidebar.tsx web/components/me/MeSidebar.test.tsx
git commit -m "feat(web): add MeSidebar shared mypage nav"
```

---

### Task 7: 마이페이지 쉘 레이아웃 + 페이지 래퍼 정리

`me/layout.tsx`로 사이드바 + 콘텐츠 컬럼을 모든 `me/*`에 적용. 프로필 페이지는 제목 정리 + 2단 폭 확보. saved 페이지의 `max-w-6xl`만 제거(컬럼이 폭을 관리). applications/coach는 충돌 래퍼가 없어 변경 없음. (순수 레이아웃 — 단위 테스트 대신 typecheck + 시각 확인)

**Files:**
- Create: `web/app/(main)/me/layout.tsx`
- Modify: `web/app/(main)/me/profile/page.tsx`
- Modify: `web/app/(main)/me/saved/page.tsx:7`

- [ ] **Step 1: Create the shell layout**

```tsx
// web/app/(main)/me/layout.tsx
import { MeSidebar } from "@/components/me/MeSidebar";

// 마이페이지 공통 쉘: 좌측 사이드바 + 콘텐츠 컬럼. (main) 레이아웃의 컨테이너 안에 들어간다.
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <MeSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Update profile page (제목 정리 + max-w 제거)**

Replace the entire contents of `web/app/(main)/me/profile/page.tsx`:

```tsx
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">프로필</h1>
        <p className="mt-2 text-muted-foreground">
          선호조건을 채우면 맞춤 공고 추천에 쓰여요. (비자 스폰서십은 기본 포함)
        </p>
      </section>
      <ProfileEditor />
    </div>
  );
}
```

- [ ] **Step 3: Remove max-w from saved page wrapper**

In `web/app/(main)/me/saved/page.tsx:7`, change:

```tsx
    <div className="mx-auto max-w-6xl space-y-6">
```

to:

```tsx
    <div className="space-y-6">
```

- [ ] **Step 4: Typecheck**

Run: `cd web && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Visual check (dev server)**

Start the stack (`./dev.sh` or `cd web && npm run dev`), log in, then visit:
- `/me/profile` — 좌측 사이드바 + 2단(폼/미리보기). 미리보기 매칭수가 로드되는지, "갱신" 동작, 6차원 체크리스트가 입력에 반응하는지, 저장 후 "저장됐어요" 표시.
- `/me/saved`, `/me/applications`, `/me/coach` — 동일 사이드바가 붙고 active 항목이 맞는지, 콘텐츠가 깨지지 않는지.
- 모바일 폭(개발자도구)에서 사이드바가 상단 가로 탭으로 접히는지.

Expected: 위 항목 모두 정상. (회귀가 보이면 해당 페이지 래퍼만 조정.)

- [ ] **Step 6: Commit**

```bash
git add web/app/\(main\)/me/layout.tsx web/app/\(main\)/me/profile/page.tsx web/app/\(main\)/me/saved/page.tsx
git commit -m "feat(web): mypage shell with shared sidebar; profile 2-col layout"
```

---

### Task 8: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: Run the full web test suite**

Run: `cd web && npm test`
Expected: 모든 테스트 PASS — 신규 5개 테스트 파일 포함, 기존 `ProfileForm.test.tsx` 등 불변 테스트도 그대로 통과.

- [ ] **Step 2: Typecheck + lint**

Run: `cd web && npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 3: Confirm shared form untouched**

Run: `git log --oneline -8 -- web/components/recommend/ProfileForm.tsx`
Expected: 이번 작업 커밋이 없음 — 공유 `ProfileForm`은 변경되지 않았다.

---

## 자체 검토 메모 (작성자 확인 완료)

- **스펙 커버리지:** 쉘(T6,T7) · 사이드바 4항목(T6) · 완성도 바 n/5(T3) · 태그칩/세그먼트/슬라이더/bio(T1,T2,T3) · 6차원 매핑(T4) · 온디맨드 매칭수 total_candidates(T4) · 상태/저장/dirty(T5) · 반응형(T6,T7) · 공유 폼 불변(T8 확인). 모두 태스크에 매핑됨.
- **플레이스홀더:** 없음 — 모든 코드/명령/기대출력 구체화.
- **타입 일관성:** `TagInput`/`Segmented` prop 시그니처가 T3에서 사용하는 형태와 일치. `RecommendProfile`/`RecommendResponse`는 `web/lib/types.ts`의 기존 타입. 미리보기 매칭수는 `RecommendResponse.total_candidates`.
- **범위 밖(YAGNI):** 계정 프로필(이름/아바타), 비자 토글, 제외 회사, 활동 요약 대시보드, 키 입력 실시간 디바운스 호출 — 모두 제외.
