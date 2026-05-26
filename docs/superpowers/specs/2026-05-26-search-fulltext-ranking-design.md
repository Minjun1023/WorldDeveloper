# 검색 품질 개선: Postgres 풀텍스트 + 관련도 랭킹 — 설계

작성일: 2026-05-26
브랜치: `worktree-search-fulltext-ranking` (격리 워크트리, origin/main 기반)
상태: 검토 대기

## 1. 개요 / 목표

`/search` 키워드 검색을 사람인급 품질로 개선한다. 현재는 제목+설명에 대한 `LIKE` 부분일치 + 최신순 정렬뿐이다. 개선: **제목·회사명·기술스택(tags)·설명**을 가중치 결합한 Postgres **풀텍스트 검색(tsvector)** + **관련도 랭킹(ts_rank)**, **정렬 토글(관련도순 기본 / 최신순)**. 신규 인프라 없음(Postgres FTS).

## 2. 범위

**포함**
- V9 마이그레이션: `jobs.search_tsv tsvector` + 트리거(제목 A·회사명 B·태그 B·설명 D 가중치) + GIN 인덱스 + 기존행 backfill.
- 키워드 검색을 네이티브 FTS 쿼리로(랭킹 + 기존 필터 + 페이지네이션). `sort` 파라미터(relevance/recent).
- 프론트: 정렬 토글(관련도순/최신순), `sort` 쿼리 파라미터 전달. 키워드 없으면 최신순.
- 백엔드 JUnit(testcontainers): 랭킹·필드커버리지·정렬 검증.

**제외**
- 자동완성, 인기/최근 검색어, 검색어 하이라이트, 오타보정(pg_trgm), 패싯 동적 재계산, Elasticsearch.

## 3. 백엔드

### 3.1 V9 마이그레이션 (`backend/src/main/resources/db/migration/V9__job_search_tsv.sql`)
- `ALTER TABLE jobs ADD COLUMN search_tsv tsvector;`
- 트리거 함수 `jobs_search_tsv_update()`: `NEW.search_tsv =` setweight 결합
  - `to_tsvector('english', coalesce(title,''))` 가중치 **A**
  - 회사명: `(SELECT display_name FROM companies WHERE slug = NEW.company_slug)` 가중치 **B**
  - 태그: `array_to_string(tags,' ')` 가중치 **B**
  - 설명: `description_text` 가중치 **D**
- `BEFORE INSERT OR UPDATE OF title, company_slug, tags, description_text` 트리거.
- 기존행 backfill `UPDATE`.
- `CREATE INDEX idx_jobs_search_tsv ON jobs USING GIN (search_tsv);`
- `ddl-auto: validate` 안전(엔티티에 매핑 안 함 → 추가 컬럼은 검증 무시). 적재/엔티티 코드 변경 없음.
- 한계(주석): 회사명 변경 시 job tsv 미갱신(회사명 안정적이라 수용), 'english' 설정(공고가 영어).

### 3.2 JobRepository — 네이티브 FTS 쿼리
- `searchKeywordIds(q, visa, loc, remote, byRelevance, lim, off)`: `search_tsv @@ websearch_to_tsquery('english', :q)` + 선택적 필터(`:x IS NULL OR ...`) + `ORDER BY CASE WHEN :byRelevance THEN ts_rank(...) END DESC NULLS LAST, posted_at DESC NULLS LAST` + LIMIT/OFFSET. 반환 `List<String>`(id).
- `countKeyword(q, visa, loc, remote)`: 같은 WHERE의 count.
- `loc`는 `%소문자%` 또는 null, `visa`는 trim 또는 null, `remote`는 Boolean 또는 null.

### 3.3 JobService.search — sort 파라미터 + 키워드 분기
- 시그니처에 `String sort` 추가.
- **q 있음**: `byRelevance = !"recent".equals(sort)`; `searchKeywordIds`로 id 페이지 + `countKeyword`로 total → `findAllById` 후 **id 순서 보존**해 DTO 매핑.
- **q 없음**: 기존 Specification 경로(최신순) 유지(회귀 없음). 필터/facets 동일.

### 3.4 JobController
- `@RequestParam(required=false) String sort` 추가 → `service.search(q, visa, location, remote, sort, page, pageSize)`.

### 3.5 테스트 (`JobSearchTest`, testcontainers, 기존 통합테스트 베이스 따름)
- company 1 + jobs 여러 건 insert(트리거가 search_tsv 채움).
- 검증: (a) 제목 매칭이 설명 매칭보다 상위(관련도), (b) 회사명 키워드로 매칭, (c) 태그 키워드로 매칭, (d) sort=recent면 최신순, (e) 필터(remote 등) 동시 적용, (f) q 없을 때 기존 동작.

## 4. 프론트엔드

### 4.0 `useUpdateQuery` 경로 버그 수정 (선행, 필수)
현재 `web/lib/use-update-query.ts` 가 `router.push(\`/?${qs}\`)` 로 **항상 루트 `/`** 로 이동 → `/search`에서 검색/필터/페이지 이동 시 홈으로 튕김(검색 컨텍스트 상실). 소비처(SearchBar·SearchFilters·Pagination)는 전부 `/search` 컴포넌트. `usePathname()` 으로 **현재 경로 유지**로 수정: `router.push(qs ? \`${pathname}?${qs}\` : pathname)`. 이 수정 없이는 정렬 토글도 홈으로 튕김.

### 4.1 `web/lib/api.ts`
- `JobQuery`에 `sort?: string` 추가. `fetchJobs`에서 `if (query.sort) url.searchParams.set("sort", query.sort)`.

### 4.2 `web/app/search/page.tsx`
- `const sort = str(searchParams.sort) ?? (q ? "relevance" : "recent")` → `fetchJobs({..., sort})`.
- 키워드(q) 있을 때만 정렬 토글 렌더.

### 4.3 정렬 토글 (`web/components/search/SortToggle.tsx`, 신규, 클라이언트)
- `SearchFilters`와 동일 패턴(`useUpdateQuery`, pill 버튼). "관련도순"(sort=relevance|null) / "최신순"(sort=recent). 현재 선택 강조. q 있을 때만 노출(page.tsx에서 조건부).

## 5. 에러 / 엣지
- 빈/공백 q → 기존 q 없음 경로(최신순). websearch_to_tsquery는 사용자 입력 안전 파싱(특수문자 무해).
- 검색 결과 0건 → 기존 빈 상태 UI.
- 정렬 변경 시 페이지 1로(useUpdateQuery 동작 따름; 필요 시 page null 동반).
- 'english'로 index/query 설정 일치(불일치 시 매칭 안 됨 — 동일 설정 필수).

## 6. 검증
- 백엔드: `./gradlew test --tests "*JobSearch*"` (+기존 통과). 라이브: 격리 DB에 시드 후 키워드/회사명/태그 검색·정렬 토글.
- 프론트: `npm run typecheck && npm run build`.

## 7. 미해결 / 미래
- 오타보정(pg_trgm), 자동완성/인기검색어, 검색어 하이라이트, 패싯 동적 재계산, 회사명 변경 시 tsv 갱신(companies 트리거), 한국어 형태소(공고가 영어라 현재 불필요).
