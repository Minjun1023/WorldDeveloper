# 검색바 비자 셀렉터 추가 구현 계획

> 같은 워크트리 `worktree-home-full-search`(미머지)에 이어서. 프론트 전용, 백엔드 무변경(`visa` 파라미터 이미 존재).

**Goal:** 비자(전체/스폰서 가능/정보 없음/스폰서 불가)를 검색바 **드롭다운**으로 — 홈 HeroSearch + /search SearchBar 둘 다. /search의 기존 비자 **칩 제거**(드롭다운으로 통일), 원격만 칩은 유지.

---

## Task 1: VISA_OPTIONS 공용 모듈
**Create:** `web/lib/visa-options.ts`
```ts
import type { DropdownOption } from "@/components/ui/dropdown";

// "전체"(null)는 Dropdown 이 자동 제공
export const VISA_OPTIONS: DropdownOption[] = [
  { value: "sponsors", label: "스폰서 가능" },
  { value: "unclear", label: "정보 없음" },
  { value: "no_sponsor", label: "스폰서 불가" },
];
```

## Task 2: /search SearchBar 에 비자 드롭다운 + SearchFilters 칩 제거
**Modify:** `web/components/search/SearchBar.tsx` — 직무 Dropdown 다음에 비자 Dropdown 추가:
```tsx
import { VISA_OPTIONS } from "@/lib/visa-options";
// ...
      <div className="sm:w-40">
        <Dropdown
          placeholder="비자"
          options={VISA_OPTIONS}
          value={searchParams.get("visa")}
          onSelect={(v) => update({ visa: v })}
        />
      </div>
```
(키워드 + 지역 + 직무 + **비자** + 검색 순서.)

**Modify:** `web/components/search/SearchFilters.tsx` — 비자 칩(VISA_OPTIONS map + 구분선 span) 제거, **원격만 토글만** 남김. `facets` prop 이 비자 칩에만 쓰였다면 제거(미사용). 결과 예:
```tsx
"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const pillBase = "rounded-full border px-3 py-1 text-body-sm transition-colors";
function pillClass(active: boolean) {
  return cn(pillBase, active
    ? "border-primary bg-primary text-primary-foreground"
    : "border-border text-foreground hover:bg-accent");
}

export function SearchFilters() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const remote = searchParams.get("remote") === "true";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => update({ remote: remote ? null : "true" })} className={pillClass(remote)}>
        원격만
      </button>
    </div>
  );
}
```
**Modify:** `web/app/search/page.tsx` — `<SearchFilters facets={...} />` → `<SearchFilters />` (facets prop 제거).

- [ ] typecheck

## Task 3: 홈 HeroSearch 에 비자 드롭다운
**Modify:** `web/components/home/HeroSearch.tsx` — visa 로컬 상태 + 드롭다운 + 조합 URL:
```tsx
import { VISA_OPTIONS } from "@/lib/visa-options";
// ...
  const [visa, setVisa] = useState<string | null>(null);
// submit 안 params 빌드에:
  if (visa) params.set("visa", visa);
// 직무 Dropdown 다음에:
      <div className="sm:w-36">
        <Dropdown placeholder="비자" options={VISA_OPTIONS} value={visa} onSelect={setVisa} />
      </div>
```
폼 너비 여유: form className 의 `max-w-3xl` → `max-w-4xl`, 셀렉터 wrapper 들을 `sm:w-36` 로(키워드는 sm:flex-1 유지). 4개 셀렉터가 한 줄에 들어가게.

- [ ] `cd web && npm run typecheck && npm run build` 성공. 커밋:
```bash
git add web/lib/visa-options.ts web/components/search/SearchBar.tsx web/components/search/SearchFilters.tsx "web/app/search/page.tsx" web/components/home/HeroSearch.tsx
git commit -m "feat(web-search): 비자 셀렉터를 검색바 드롭다운으로(홈+/search), /search 비자 칩 제거"
```

## Task 4: 라이브 검증
- [ ] 홈: 비자 드롭다운에서 "스폰서 가능" 선택+검색 → `/search?...&visa=sponsors`. /search: 비자 드롭다운 동작, 비자 칩 사라지고 원격만 칩만 남음. 지역/직무/비자/키워드 조합.

## Self-Review
- 비자 드롭다운 홈+/search ✓. /search 비자 칩 제거, 원격만 유지, facets prop 정리 ✓. VISA_OPTIONS 공용 ✓. 백엔드 무변경(visa 파라미터 기존). 홈 셀렉터는 로컬상태→검색 시 visa 포함 URL.
