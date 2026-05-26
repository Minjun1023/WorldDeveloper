# 검색 품질 개선(Postgres FTS + 관련도 랭킹) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** `/search` 키워드 검색을 제목·회사명·태그·설명 가중치 풀텍스트(tsvector) + 관련도 랭킹(ts_rank) + 정렬 토글(관련도/최신)로 개선. 신규 인프라 없음.

**Architecture:** 백엔드 V9 마이그레이션(search_tsv + 트리거 + GIN) + 네이티브 FTS 쿼리 + JobService 분기 + sort 파라미터. 프론트 useUpdateQuery 경로 버그 수정 + sort 파라미터 + 정렬 토글.

**Tech:** Spring Boot/JPA(native query)/Flyway/Postgres FTS, Next.js/TS. 검증: JUnit(testcontainers, JdbcTemplate 네이티브 insert) + 프론트 typecheck/build.

**설계:** `docs/superpowers/specs/2026-05-26-search-fulltext-ranking-design.md`. 워크트리 `worktree-search-fulltext-ranking`.

> 핵심 사실: `JobEntity`/`CompanyEntity`는 세터·public 생성자 없음(읽기 전용). 테스트 데이터는 `JdbcTemplate` 네이티브 INSERT로 넣어야 BEFORE INSERT 트리거가 `search_tsv`를 채운다. 컬럼: jobs(title, company_slug, description_text, tags text[], location, visa_status, is_remote, is_active, posted_at, source NOT NULL, id PK), companies(slug PK, display_name NOT NULL).

---

## 파일 구조
```
backend/src/main/resources/db/migration/V9__job_search_tsv.sql   (신규)
backend/src/main/java/com/devjobs/scout/JobRepository.java        (수정) FTS 네이티브 쿼리 2개
backend/src/main/java/com/devjobs/scout/JobService.java          (수정) sort + 키워드 FTS 분기
backend/src/main/java/com/devjobs/scout/JobController.java        (수정) sort 파라미터
backend/src/test/java/com/devjobs/scout/JobSearchTest.java        (신규) testcontainers
web/lib/use-update-query.ts          (수정) 현재 경로 유지(버그 수정)
web/lib/api.ts                       (수정) sort 파라미터
web/components/search/SortToggle.tsx (신규) 정렬 토글
web/app/search/page.tsx              (수정) sort 계산 + 토글 렌더
```

---

## Task 1: V9 마이그레이션 (search_tsv + 트리거 + GIN)
**Create:** `backend/src/main/resources/db/migration/V9__job_search_tsv.sql`

- [ ] **Step 1: 작성**
```sql
-- jobs 풀텍스트 검색: 제목(A)/회사명(B)/태그(B)/설명(D) 가중치 tsvector + GIN 인덱스.
-- 트리거로 유지(회사명은 슬러그로 companies 조회). ddl-auto=validate 안전(엔티티 미매핑 → 추가 컬럼 무시).
ALTER TABLE jobs ADD COLUMN search_tsv tsvector;

CREATE OR REPLACE FUNCTION jobs_search_tsv_update() RETURNS trigger AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT display_name FROM companies WHERE slug = NEW.company_slug), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.description_text, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_search_tsv
    BEFORE INSERT OR UPDATE OF title, company_slug, tags, description_text ON jobs
    FOR EACH ROW EXECUTE FUNCTION jobs_search_tsv_update();

-- 기존 행 backfill
UPDATE jobs SET search_tsv =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(
        (SELECT display_name FROM companies WHERE slug = jobs.company_slug), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description_text, '')), 'D');

CREATE INDEX idx_jobs_search_tsv ON jobs USING GIN (search_tsv);
```

- [ ] **Step 2: 컴파일 sanity + 커밋** (적용 검증은 Task 4 testcontainers)
Run: `cd backend && ./gradlew compileJava` → 성공
```bash
git add backend/src/main/resources/db/migration/V9__job_search_tsv.sql
git commit -m "feat(search): V9 jobs search_tsv 가중치 풀텍스트 + 트리거 + GIN"
```

---

## Task 2: JobRepository — 네이티브 FTS 쿼리
**Modify:** `backend/src/main/java/com/devjobs/scout/JobRepository.java`

- [ ] **Step 1: 메서드 2개 추가** (인터페이스 안, 기존 import의 `@Query`/`@Param` 사용)
```java
    // 풀텍스트 키워드 검색: 매칭 job id (관련도/최신 정렬, 필터 동시 적용, 페이지). CAST 로 null 파라미터 타입 명시.
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true
          AND search_tsv @@ websearch_to_tsquery('english', :q)
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        ORDER BY
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', :q)) END DESC NULLS LAST,
          posted_at DESC NULLS LAST
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchKeywordIds(
        @Param("q") String q, @Param("visa") String visa, @Param("loc") String loc,
        @Param("remote") Boolean remote, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);

    @Query(value = """
        SELECT count(*) FROM jobs
        WHERE is_active = true
          AND search_tsv @@ websearch_to_tsquery('english', :q)
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        """, nativeQuery = true)
    long countKeyword(
        @Param("q") String q, @Param("visa") String visa, @Param("loc") String loc,
        @Param("remote") Boolean remote);
```

- [ ] **Step 2: 컴파일 + 커밋**
Run: `cd backend && ./gradlew compileJava` → 성공
```bash
git add backend/src/main/java/com/devjobs/scout/JobRepository.java
git commit -m "feat(search): JobRepository FTS 네이티브 쿼리(검색/카운트)"
```

---

## Task 3: JobService 분기 + JobController sort
**Modify:** `JobService.java`, `JobController.java`

- [ ] **Step 1: JobService.search 교체 + keywordSearch 추가**
import 추가: `import java.util.HashMap;`, `import java.util.Objects;` (기존 List/Map/Optional/LinkedHashMap 유지).
`search(...)` 메서드를 아래로 교체(시그니처에 `String sort` 추가):
```java
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        if (q != null && !q.isBlank()) {
            return keywordSearch(q.trim(), visa, location, remote, sort, safePage, safeSize);
        }

        // 키워드 없음: 기존 Specification 경로(최신순) — 회귀 없음
        Specification<JobEntity> spec = JobSpecifications.isActive();
        if (visa != null && !visa.isBlank()) {
            spec = spec.and(JobSpecifications.visaStatus(visa.trim()));
        }
        if (location != null && !location.isBlank()) {
            spec = spec.and(JobSpecifications.location(location.trim()));
        }
        if (remote != null) {
            spec = spec.and(JobSpecifications.remote(remote));
        }
        Pageable pageable = PageRequest.of(
            safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "postedAt"));
        Page<JobEntity> result = repository.findAll(spec, pageable);
        List<JobDto> items = result.getContent().stream().map(this::toDto).toList();
        return new JobListResponse(
            items, safePage, safeSize, result.getTotalElements(), computeFacets());
    }

    private JobListResponse keywordSearch(
        String q, String visa, String location, Boolean remote, String sort, int safePage, int safeSize) {

        boolean byRelevance = !"recent".equals(sort);
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchKeywordIds(
            q, visaParam, locParam, remote, byRelevance, safeSize, offset);
        long total = repository.countKeyword(q, visaParam, locParam, remote);

        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) {
            byId.put(j.getId(), j);
        }
        List<JobDto> items = ids.stream()
            .map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();

        return new JobListResponse(items, safePage, safeSize, total, computeFacets());
    }
```
(다른 메서드 `listByCompany`/`findById`/`toDto`/`computeFacets`/`preview` 무변경.)

- [ ] **Step 2: JobController.list 에 sort 파라미터 추가**
```java
    @GetMapping
    public JobListResponse list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String visa,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) Boolean remote,
        @RequestParam(required = false) String sort,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.search(q, visa, location, remote, sort, page, pageSize);
    }
```
다른 `service.search(` 호출부 없는지 확인: `grep -rn "service.search(\|\.search(" backend/src/main` — JobController 만 있어야 함.

- [ ] **Step 3: 컴파일 + 커밋**
Run: `cd backend && ./gradlew compileJava` → 성공
```bash
git add backend/src/main/java/com/devjobs/scout/JobService.java backend/src/main/java/com/devjobs/scout/JobController.java
git commit -m "feat(search): JobService 키워드 FTS 분기 + sort 파라미터"
```

---

## Task 4: JobSearchTest (testcontainers, JdbcTemplate 네이티브 insert)
**Create:** `backend/src/test/java/com/devjobs/scout/JobSearchTest.java`

- [ ] **Step 1: 작성**
```java
package com.devjobs.scout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.scout.dto.JobDtos.JobListResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Transactional
class JobSearchTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired JobService service;
    @Autowired JdbcTemplate jdbc;

    private void company(String slug, String name) {
        jdbc.update("INSERT INTO companies(slug, display_name) VALUES (?, ?)", slug, name);
    }

    /** tagsCsv: 쉼표구분 문자열 (없으면 null). postedSql: posted_at SQL 식 (예 "now()"). */
    private void job(String id, String title, String slug, String descText,
                     String tagsCsv, boolean remote, String postedSql) {
        jdbc.update(
            "INSERT INTO jobs(id, source, title, company_slug, description_text, tags, is_remote, posted_at, is_active) "
          + "VALUES (?, 'test', ?, ?, ?, "
          + (tagsCsv == null ? "NULL" : "string_to_array(?, ',')")
          + ", ?, " + postedSql + ", true)",
            tagsCsv == null
                ? new Object[]{ id, title, slug, descText, remote }
                : new Object[]{ id, title, slug, descText, tagsCsv, remote });
    }

    @Test
    void relevanceRanksTitleAboveDescription() {
        company("acme", "Acme Inc");
        job("j1", "Backend Engineer", "acme", "we use python", "backend,go", false, "now()");
        job("j2", "Data Analyst", "acme", "occasional backend chores", "sql", false, "now()");
        JobListResponse res = service.search("backend", null, null, null, null, 1, 20);
        assertTrue(res.total() >= 2, "둘 다 매칭");
        assertEquals("j1", res.items().get(0).id(), "제목 매칭이 설명 매칭보다 상위");
    }

    @Test
    void matchesCompanyName() {
        company("stripe", "Stripe");
        job("s1", "Software Engineer", "stripe", "build payments", "go", false, "now()");
        JobListResponse res = service.search("stripe", null, null, null, null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("s1")), "회사명으로 매칭");
    }

    @Test
    void matchesTag() {
        company("acme2", "Acme Two");
        job("t1", "Engineer", "acme2", "no keyword in text", "kubernetes,docker", false, "now()");
        JobListResponse res = service.search("kubernetes", null, null, null, null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("t1")), "태그로 매칭");
    }

    @Test
    void recentSortOrdersByPostedAt() {
        company("acme3", "Acme Three");
        job("old", "Backend Dev", "acme3", "x", "backend", false, "now() - interval '5 days'");
        job("new", "Backend Dev", "acme3", "x", "backend", false, "now()");
        JobListResponse res = service.search("backend", null, null, null, "recent", 1, 20);
        assertEquals("new", res.items().get(0).id(), "최신순이면 새 공고 먼저");
    }

    @Test
    void filterAppliesWithKeyword() {
        company("acme4", "Acme Four");
        job("r1", "Backend Engineer", "acme4", "x", "backend", true, "now()");
        job("r2", "Backend Engineer", "acme4", "x", "backend", false, "now()");
        JobListResponse res = service.search("backend", null, null, true, null, 1, 20);
        assertTrue(res.items().stream().allMatch(j -> j.id().equals("r1")) && res.total() == 1,
            "원격 필터 + 키워드 동시 적용");
    }

    @Test
    void noKeywordReturnsActiveJobs() {
        company("acme5", "Acme Five");
        job("n1", "Whatever", "acme5", "x", null, false, "now()");
        JobListResponse res = service.search(null, null, null, null, null, 1, 20);
        assertTrue(res.total() >= 1, "키워드 없으면 기존 경로로 active 공고 반환");
    }
}
```
참고: `JobListResponse`/`JobDto` 는 record (`res.total()`, `res.items()`, `j.id()`). 만약 record 컴포넌트명이 다르면 실제 접근자에 맞춰 조정. `@Transactional` 롤백으로 테스트 간 격리.

- [ ] **Step 2: 실행 + 커밋**
Run: `cd backend && ./gradlew test --tests "com.devjobs.scout.JobSearchTest"` → 전부 통과 (Docker 필요)
Expected: 6 통과. 실패 시 로그로 원인(쿼리/접근자) 수정.
```bash
git add backend/src/test/java/com/devjobs/scout/JobSearchTest.java
git commit -m "test(search): FTS 랭킹/필드/정렬/필터 검증 (testcontainers)"
```

---

## Task 5: useUpdateQuery 경로 버그 수정
**Modify:** `web/lib/use-update-query.ts`

- [ ] **Step 1: 현재 경로 유지로 수정** — `usePathname()` 추가, 하드코딩 `/` 제거.
```ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * URL 쿼리스트링을 갱신하는 훅. 검색/필터 상태는 URL 이 single source of truth.
 * page 키가 아닌 값을 바꾸면 page 를 리셋(1페이지로). 현재 경로(pathname)는 유지.
 */
export function useUpdateQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (!("page" in updates)) {
        params.delete("page");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**
Run: `cd web && npm run typecheck` → 에러 없음
```bash
git add web/lib/use-update-query.ts
git commit -m "fix(web-search): useUpdateQuery 가 현재 경로 유지(홈으로 튕기던 버그 수정)"
```

---

## Task 6: api.ts sort 파라미터
**Modify:** `web/lib/api.ts`

- [ ] **Step 1: JobQuery + fetchJobs** — `JobQuery` 인터페이스에 `sort?: string;` 추가, `fetchJobs` URL 빌드에 추가:
```ts
  if (query.sort) url.searchParams.set("sort", query.sort);
```
(기존 page/page_size 설정 라인 부근에 추가.)

- [ ] **Step 2: 타입체크 + 커밋**
Run: `cd web && npm run typecheck` → 에러 없음
```bash
git add web/lib/api.ts
git commit -m "feat(web-search): fetchJobs sort 파라미터"
```

---

## Task 7: SortToggle + search 페이지 배선
**Create:** `web/components/search/SortToggle.tsx`  **Modify:** `web/app/search/page.tsx`

- [ ] **Step 1: SortToggle 작성** (SearchFilters 패턴: useUpdateQuery + pill)
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

export function SortToggle() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const sort = searchParams.get("sort");
  const isRecent = sort === "recent";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => update({ sort: null })}
        className={pillClass(!isRecent)}
      >
        관련도순
      </button>
      <button
        type="button"
        onClick={() => update({ sort: "recent" })}
        className={pillClass(isRecent)}
      >
        최신순
      </button>
    </div>
  );
}
```

- [ ] **Step 2: search/page.tsx 배선** — sort 계산 + fetchJobs 전달 + 키워드 있을 때 토글 렌더.
import 추가: `import { SortToggle } from "@/components/search/SortToggle";`
`page` 계산 다음에:
```tsx
  const sort = str(searchParams.sort) ?? (q ? "relevance" : "recent");
```
`fetchJobs` 호출에 `sort` 추가:
```tsx
  const result = await fetchJobs({ q, visa, location, remote, sort, page, pageSize: PAGE_SIZE });
```
결과 헤더(`<div className="flex items-baseline justify-between">` 내부, 건수 옆/위)에서 q 있을 때 토글 노출. 기존:
```tsx
        <div className="flex items-baseline justify-between">
          <h2 className="text-h2">공고</h2>
          {result.ok && (
            <span className="text-caption text-muted-foreground">{result.data.total}건</span>
          )}
        </div>
```
를 아래로:
```tsx
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-h2">공고</h2>
          <div className="flex items-center gap-3">
            {q && <SortToggle />}
            {result.ok && (
              <span className="text-caption text-muted-foreground">{result.data.total}건</span>
            )}
          </div>
        </div>
```

- [ ] **Step 3: 타입체크 + 빌드 + 커밋**
Run: `cd web && npm run typecheck && npm run build` → 성공
```bash
git add web/components/search/SortToggle.tsx "web/app/search/page.tsx"
git commit -m "feat(web-search): 정렬 토글(관련도/최신) + sort 배선"
```

---

## Task 8: 라이브 검증 (워크트리 스택, 격리 DB)
- [ ] 격리 DB `devjobs_wt3` 생성 → 백엔드(8081)+웹(3100) 기동. (FTS는 데이터 필요 → 시드 또는 기존 dev 데이터 복제. 시드: company 1 + jobs 몇 건 JdbcTemplate/psql 로 insert.)
- [ ] `/search`:
  - 키워드 입력 → **홈으로 안 튕기고** `/search`에 머무름(useUpdateQuery 수정 확인).
  - 회사명/태그 키워드로 결과 나옴, 관련도순 기본(제목매칭 상위), 최신순 토글 동작.
  - 필터(원격 등) + 키워드 동시.
- [ ] 검증 후 스택 종료 + `devjobs_wt3` DROP.

> psql 시드 예: `INSERT INTO companies(slug,display_name) VALUES('stripe','Stripe'); INSERT INTO jobs(id,source,title,company_slug,description_text,tags,posted_at,is_active) VALUES('x1','seed','Backend Engineer','stripe','python and go',ARRAY['backend','go'],now(),true);`

---

## Self-Review (작성자 체크)
- **스펙 커버리지**: FTS+가중치(T1) ✓, 네이티브 쿼리+랭킹(T2) ✓, sort 분기(T3) ✓, 테스트(T4) ✓, useUpdateQuery 버그(T5) ✓, sort 파라미터(T6) ✓, 토글+배선(T7) ✓.
- **타입/계약 일관성**: `searchKeywordIds`/`countKeyword` 파라미터 순서 (q, visa, loc, remote[, byRelevance, lim, off]) ↔ JobService 호출 일치. `sort` 문자열 relevance/recent ↔ 프론트 토글(sort=null=relevance, sort=recent) ↔ page.tsx 기본값. `JobQuery.sort` ↔ fetchJobs ↔ 백엔드 @RequestParam sort.
- **회귀**: q 없음/recent 경로는 기존 Specification 그대로. 다른 service.search 호출부 없음(T3에서 확인). 엔티티/적재 미변경, ddl validate 안전.
- **주의**: 네이티브 null 파라미터는 CAST 로 타입 명시. record 접근자명은 실제에 맞춰(테스트). 'english' index/query 설정 일치.
