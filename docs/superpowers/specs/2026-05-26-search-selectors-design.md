# 사람인식 선택형 검색바 (지역/직무 드롭다운) — 설계

작성일: 2026-05-26
브랜치: `worktree-search-selectors` (격리 워크트리, origin/main 기반 — FTS 머지 후)
상태: 검토 대기

## 1. 개요 / 목표

`/search` 검색바를 사람인 스타일 **3단 구성**으로: `키워드 입력` + `지역 ▼`(국가 목록+건수) + `직무 ▼`(개발 직무 카테고리) + `검색`. 지역/직무는 드롭다운에서 **선택**. 방금 머지한 FTS(search_tsv) 인덱스를 직무 매칭에 재사용.

## 2. 범위

**포함**
- 지역 드롭다운: 큐레이션 국가(독일/네덜란드/영국/아일랜드) + "전체", 각 건수. 선택 → 기존 `location` 필터.
- 직무 드롭다운: 카테고리(백엔드/프론트엔드/풀스택/모바일/데이터·ML/DevOps·인프라) + "전체". 선택 → 신규 `discipline` 파라미터 → 백엔드가 카테고리→tsquery로 search_tsv 매칭.
- 백엔드: 검색 쿼리 일반화(q·discipline 둘 다 optional), `discipline` 파라미터 + 카테고리 매핑, 국가 건수 엔드포인트.
- 프론트: 신규 `Dropdown` UI + `SearchBar` 개편(키워드+지역+직무+검색), `api.ts`/`page.tsx` 배선.

**제외**
- 다중 선택, 자동완성, 인기/최근 검색어, 직무 건수, 신규 국가/카테고리 추가(목록은 코드 상수, 추후 확장).

## 3. 백엔드

### 3.1 JobRepository — 검색 쿼리 일반화 (q·discipline optional)
기존 `searchKeywordIds`/`countKeyword`(q 필수)를 `searchIds`/`countSearch`(q·disc optional)로 교체:
- WHERE: `(CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))` AND `(CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))` AND 기존 visa/loc/remote.
- ORDER BY: `CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST, posted_at DESC NULLS LAST, id DESC`.
- 신규 `countActiveByLocationLike(:pattern)`(국가 건수용).
- `:disc`는 서버 큐레이션 tsquery 문자열(사용자 입력 아님) — to_tsquery 문법 안전.

### 3.2 JobService
- `DISCIPLINE_TERMS: Map<String,String>` (카테고리 value → tsquery 토큰, ` | ` 구분, 단어 토큰만). 예: backend → `backend | server | api | spring | django | rails | node | golang`.
- `COUNTRIES: List<{value,label}>` (Germany/독일 등; CountryTiles와 일관).
- `search(q, visa, location, remote, sort, discipline, page, pageSize)`:
  - hasQuery = q non-blank; discTerms = DISCIPLINE_TERMS.get(discipline) (없으면 null).
  - **q 또는 discTerms 있으면** 네이티브 경로(`searchIds`+`countSearch`, byRelevance=hasQuery && !"recent".equals(sort), id순서 보존 매핑).
  - 둘 다 없으면 기존 Specification 경로(최신순) 유지.
- `countryCounts()`: COUNTRIES 각각 `countActiveByLocationLike("%"+value.toLowerCase()+"%")` → `List<CountryCount>`(value,label,count).

### 3.3 JobController
- `list(...)`에 `@RequestParam(required=false) String discipline` 추가 → 서비스 전달.
- `@GetMapping("/countries")` → `service.countryCounts()`. (literal 경로가 `{id:.+}` 패턴보다 우선 — 확인.)
- DTO: `JobDtos`에 `record CountryCount(String value, String label, long count)`.

### 3.4 테스트 (`JobSearchSelectorsTest`, testcontainers, JdbcTemplate insert)
- discipline=backend → 백엔드류 매칭, discipline+키워드 AND, discipline만(키워드 없이)도 동작·최신순, countryCounts 건수 정확, 잘못된 discipline 무시.

## 4. 프론트엔드

### 4.1 `Dropdown` (신규 `web/components/ui/dropdown.tsx`, 클라이언트)
- 버튼(선택값/placeholder + chevron) + 패널(옵션 목록). 바깥 클릭 시 닫힘(useRef+effect). props: `label`(placeholder), `options: {value,label,count?}[]`, `value`, `onSelect(value|null)`. "전체"=value null.

### 4.2 `SearchBar` 개편
- 키워드 Input(기존 로컬 state, 제출 시 `update({q})`) + `RegionDropdown` + `DisciplineDropdown` + 검색 버튼. 한 줄(모바일 세로).
- RegionDropdown: props countries(서버 전달); 선택 → `update({location: value})`("전체"→null).
- DisciplineDropdown: 정적 카테고리 상수; 선택 → `update({discipline: value})`.
- 지역/직무는 선택 즉시 URL 갱신(기존 필터 패턴), 키워드는 검색/Enter.

### 4.3 `api.ts` / `page.tsx`
- `JobQuery.discipline?: string` + fetchJobs 전달. 신규 `fetchCountries()`(서버 → `/api/v1/jobs/countries`).
- `page.tsx`: `discipline = str(searchParams.discipline)` → fetchJobs 전달; `fetchCountries()` 결과를 `<SearchBar countries=...>` 로. (SearchFilters/SortToggle 무변경.)

## 5. 에러 / 엣지
- 잘못된 discipline 값 → 매핑 없음 → 무시(필터 미적용). 빈 q+빈 disc → 기존 경로.
- to_tsquery 토큰은 서버 상수라 항상 유효. websearch_to_tsquery는 사용자 q 안전.
- `/countries` 라우팅이 `{id:.+}`와 충돌 안 하는지 확인(literal 우선).
- 드롭다운 a11y: 버튼 aria-expanded, 옵션 버튼 type=button.

## 6. 검증
- 백엔드: `./gradlew test --tests "*JobSearchSelectors*"` (+기존 통과). 라이브: 격리 DB 시드 후 지역/직무 선택 결과·건수.
- 프론트: `npm run typecheck && npm run build`. 라이브(Playwright): 지역/직무 드롭다운 선택 → 필터링, 키워드 동시.

## 7. 미해결 / 미래
- 다중 선택, 직무 건수, 자동완성/인기검색어, 국가/카테고리 동적화(데이터 기반), 국가 파싱 정교화(현재 location LIKE).
