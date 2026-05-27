# 스폰서 우선 정렬 + 홈 격상 설계

**작성일:** 2026-05-27
**상태:** 승인됨 (구현 대기)

## 배경 / 문제

WorldDeveloper는 비자 스폰서십 명시 공고를 핵심 가치로 내세우는 한국 개발자용 해외 취업 사이트다. 그러나 active 공고 929건 중 비자 상태 분포는 unclear 770 / sponsors 91 / no_sponsor 68 로, 대다수(83%)가 "정보 없음"이다. 이는 분류 실패가 아니라 대다수 공고가 비자 정책을 실제로 명시하지 않은 정직한 결과이며, 추정으로 줄이면 오분류가 발생한다(별도 진단으로 확인됨).

문제는 데이터가 아니라 **배치**다. 현재 `/search`는 최신순 기본이고 비자는 드롭다운 필터에 묻혀 있으며, 홈의 "비자 스폰서십 공고" 섹션은 세 번째 가로 스크롤 행으로 격하돼 있다. 그래서 사용자에게는 770건의 "정보 없음"이 사이트의 인상이 되고, 가장 값진 91건의 스폰서 공고가 묻힌다.

## 목표

스폰서 확실한 공고(91건)를 사이트의 주인공으로 끌어올린다. "정보 없음을 줄인다"가 아니라 "스폰서 공고를 앞세운다"가 목표다.

**사용자 결정(확정):**
- 강도: **스폰서 우선 정렬** (전체 공고는 그대로 보이되 정렬이 스폰서를 위로). 전체-숨김(스폰서만)도 아니고 전용 허브 신설도 아님.
- 키워드 검색 시 우선순위: **비자 티어 1순위** (스폰서 → unclear → no_sponsor), 티어 안에서 관련도/최신.
- no_sponsor: **맨 뒤로** (숨기지 않음, "스폰서 불가" 빨간 배지로 명확히 표시되어 사용자가 거름).

## 비목표 (YAGNI)

- 검색 화면의 비자 건수 칩/요약 — 이번엔 안 함.
- 전용 `/sponsors` 페이지 — 안 함.
- no_sponsor 기본 숨김 — 안 함.
- 스폰서 인벤토리 확대(ATS/소스 추가) — 별도 작업(후속).

## 설계

### 1. 정렬 (백엔드 — 핵심)

비자 상태를 정렬의 1순위 티어로 둔다. 키는 `sponsors=0, unclear=1, no_sponsor=2` (작을수록 위).

`JobRepository.searchIds` / `countSearch`는 이미 모든 필터(q/disc/region/visa/loc/remote)가 optional이다. `searchIds`의 ORDER BY 맨 앞에 비자 티어 CASE를 추가하고, 티어 적용 여부를 `:visaPriority` 불리언으로 제어한다:

```sql
ORDER BY
  CASE WHEN :visaPriority THEN
    (CASE visa_status WHEN 'sponsors' THEN 0 WHEN 'no_sponsor' THEN 2 ELSE 1 END)
  ELSE 0 END,
  CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
  posted_at DESC NULLS LAST,
  id DESC
```

`searchIds`에 `@Param("visaPriority") boolean visaPriority` 추가. `countSearch`는 정렬과 무관하므로 변경 없음.

**`JobService.search` 통일:** 현재 q/discipline/region이 모두 없으면 Specification 경로(`findAll(spec, Sort.by(postedAt DESC))`)로 빠지는 early-return 분기를 제거하고, 모든 조회를 native(searchIds/countSearch) 경로로 통일한다. searchIds가 visa/location(LIKE)/remote 필터를 모두 지원하므로 Specification 경로가 하던 일을 그대로 커버한다.

- `visaPriority = !"newest".equals(sort)` — 기본 켜짐, `newest`일 때만 끔.
- `byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort)` — q 있고 관련도 모드일 때만 ts_rank.
- `loc` LIKE 파라미터는 기존 native 경로 로직 그대로(`"%"+lower+"%"`).

이때 `JobSpecifications`의 일부 메서드(visaStatus/location/remote)가 search()에서 더 이상 쓰이지 않을 수 있다. `isActive()`만 남고 나머지가 미사용이면 미사용 메서드는 제거한다(다른 호출처가 없을 때만 — 구현 시 확인).

**정렬 계약 (sort 파라미터):**

| sort 값 | 적용 정렬 | 용도 |
|---|---|---|
| (없음, 기본) | 티어 + posted_at DESC | `/search` 기본 둘러보기 |
| `relevance` | 티어 + ts_rank + posted_at | 키워드 검색 기본(q 있을 때) |
| `recent` | 티어 + posted_at | 검색 결과에서 "최신순" 토글 |
| `newest` | **티어 없이** posted_at DESC | 홈 "새로 올라온 공고" 쇼케이스 전용 |

기존 관련도↔최신 토글(`SortToggle`, q 있을 때만 노출)은 "티어 내부 정렬"로 의미만 바뀌고 UI/값(`recent`)은 그대로 유지된다.

### 2. 홈 레이아웃 격상 (프론트)

`web/app/page.tsx` 섹션 순서를 변경한다.

현재: Hero → 나에게 맞는 공고(NL추천) → 비자 스폰서십 공고 → 국가별 → 새로 올라온 공고 → 주목할 회사

변경: **Hero → 비자 스폰서십 공고(격상) → 나에게 맞는 공고 → 국가별 → 새로 올라온 공고 → 주목할 회사**

"비자 스폰서십 공고" 섹션 강화:
- 히어로 바로 아래 최상단으로 이동.
- 섹션 헤더에 **건수 표기**: "비자 스폰서십 공고 N개" (N = 해당 응답의 total; `fetchJobs({visa:"sponsors"})`의 `total` 사용).
- CTA: "전체 스폰서 공고 보기 →" (`/search?visa=sponsors`). 기존 `SectionHeader`의 href/hrefLabel 재사용.
- 표시 형식은 기존 `JobScrollRow` 유지(레이아웃 리스크 최소화). 건수만 헤더에 추가.

"새로 올라온 공고" 섹션: `fetchJobs({ pageSize: 6, sort: "newest" })`로 호출해 티어 없이 순수 최신 유지.

**프론트 API:** `web/lib/api.ts`의 `JobQuery.sort`가 이미 `string`이면 `"newest"` 전달에 무변경(타입이 좁으면 확장). `SectionHeader`에 옵션 prop `count?: number`를 추가해 제목 옆에 건수를 렌더(없으면 미표시) — title 문자열 합치기 방식은 쓰지 않음.

### 3. 데이터 흐름

1. `/search` 요청 → `JobController` → `JobService.search(...)` → native `searchIds`(visaPriority 계산) + `countSearch` → DTO 매핑.
2. 홈 → `fetchJobs({visa:"sponsors", pageSize:8})`(스폰서 단일 티어, 티어 정렬 무의미하나 무해) + `fetchJobs({pageSize:6, sort:"newest"})`(순수 최신).

### 4. 에러 처리 / 엣지

- 빈 결과: 기존 "조건에 맞는 공고가 없습니다" 메시지 유지.
- 백엔드 다운: 기존 처리 유지.
- `visaPriority`/`byRelevance` 조합으로 정렬 키가 모두 무효(NULLS LAST)면 posted_at/id가 안정적 순서 보장(기존과 동일, 페이지네이션 안정).

## 테스트

**백엔드 (testcontainers, pgvector):**
- 시드: 같은 키워드를 가진 공고를 visa_status sponsors/unclear/no_sponsor로 3건 + posted_at 차등.
- 기본 정렬(visaPriority): sponsors가 unclear보다, unclear가 no_sponsor보다 위.
- `sort=newest`: 티어 무시, posted_at DESC 순.
- q 있는 검색 + 기본: 티어가 1순위, 같은 티어 안에서 ts_rank.
- 기존 `JobSearchTest`/`JobSearchSelectorsTest` 회귀(시그니처에 visaPriority/sort 반영).

**프론트:**
- `web tsc --noEmit` 클린.
- 라이브(격리: 워크트리 web@3001 + 실 backend 8080, 실 devjobs): `/search` 기본에서 첫 페이지 상단이 "스폰서 가능" 배지 공고로 시작 / no_sponsor가 뒤쪽 / 홈 최상단이 "비자 스폰서십 공고 N개" 섹션 / 홈 "새로 올라온 공고"는 스폰서가 위로 안 쏠림(순수 최신).

## 영향 범위

- 백엔드: `JobRepository.searchIds`(+param), `JobService.search`(경로 통일), 가능 시 `JobSpecifications` 미사용 메서드 정리. 마이그레이션 없음(컬럼 변경 없음).
- 프론트: `web/app/page.tsx`(섹션 순서+건수), `web/components/home/SectionHeader.tsx`(count prop, 필요 시), `web/lib/api.ts`(sort=newest 전달, 기존 타입이면 무변경).
- DB/마이그레이션/AI: 변경 없음.
