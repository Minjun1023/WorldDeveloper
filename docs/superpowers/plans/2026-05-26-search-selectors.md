# 사람인식 선택형 검색바 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** `/search` 검색바를 키워드 + 지역(국가+건수) + 직무(개발 카테고리) 드롭다운 + 검색 으로. FTS search_tsv 재사용.

**Architecture:** 백엔드 검색 쿼리 일반화(q·discipline optional) + discipline 카테고리→tsquery 매핑 + 국가 건수 엔드포인트. 프론트 Dropdown UI + SearchBar 개편.

**Tech:** Spring/JPA native, Postgres FTS, Next/TS, lucide. 검증: JUnit(testcontainers) + typecheck/build + 라이브.

**설계:** `docs/superpowers/specs/2026-05-26-search-selectors-design.md`. 워크트리 `worktree-search-selectors`(FTS 머지된 main 기반 — search_tsv/트리거/GIN 존재).

> 핵심: JobEntity/CompanyEntity 읽기전용 → 테스트는 JdbcTemplate insert. 네이티브 null 파라미터는 `CAST(:p AS type)`. `JobListResponse`/`JobDto` record(`total()`,`items()`,`id()`). discipline tsquery 토큰은 서버 상수(사용자입력 아님).

---

## 파일 구조
```
backend/.../scout/JobRepository.java          (수정) searchIds/countSearch(q·disc optional) + countActiveByLocationLike
backend/.../scout/dto/JobDtos.java            (수정) CountryCount record
backend/.../scout/JobService.java             (수정) discipline 매핑 + 일반화 search + countryCounts
backend/.../scout/JobController.java          (수정) discipline 파라미터 + /countries
backend/.../test/.../scout/JobSearchSelectorsTest.java (신규)
web/components/ui/dropdown.tsx                (신규)
web/lib/api.ts                                (수정) discipline + fetchCountries
web/app/search/page.tsx                       (수정) discipline + countries 배선
web/components/search/SearchBar.tsx           (수정) 키워드+지역+직무+검색
```

---

## Task 1: JobRepository — 쿼리 일반화 + 국가 건수
**Modify:** `backend/src/main/java/com/devjobs/scout/JobRepository.java`

- [ ] **Step 1**: 기존 `searchKeywordIds`/`countKeyword` 두 메서드를 아래 3개로 교체(나머지 메서드 유지):
```java
    // 풀텍스트 검색(키워드 q + 직무 disc 모두 optional). disc 는 서버 큐레이션 tsquery 문자열.
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        ORDER BY
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
          posted_at DESC NULLS LAST,
          id DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchIds(
        @Param("q") String q, @Param("disc") String disc, @Param("visa") String visa,
        @Param("loc") String loc, @Param("remote") Boolean remote, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);

    @Query(value = """
        SELECT count(*) FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        """, nativeQuery = true)
    long countSearch(
        @Param("q") String q, @Param("disc") String disc, @Param("visa") String visa,
        @Param("loc") String loc, @Param("remote") Boolean remote);

    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND location ILIKE CAST(:pattern AS text)",
        nativeQuery = true)
    long countActiveByLocationLike(@Param("pattern") String pattern);
```

- [ ] **Step 2**: `cd backend && ./gradlew compileJava`(JobService도 같이 고쳐야 컴파일됨 → Task 2와 함께 커밋). 일단 Task 2까지 한 뒤 컴파일.

---

## Task 2: JobDtos + JobService + JobController
**Modify:** `JobDtos.java`, `JobService.java`, `JobController.java`

- [ ] **Step 1: JobDtos** — `JobListResponse` record 아래에 추가:
```java
    public record CountryCount(String value, String label, long count) {}
```

- [ ] **Step 2: JobService** — import 추가 `import com.devjobs.scout.dto.JobDtos.CountryCount;`. 상수 추가(클래스 상단 필드부):
```java
    // 직무 카테고리 → tsquery 토큰(서버 큐레이션, ' | ' OR). 튜닝 가능.
    private static final Map<String, String> DISCIPLINE_TERMS = Map.of(
        "backend", "backend | server | api | spring | django | rails | golang | node",
        "frontend", "frontend | react | vue | angular | svelte",
        "fullstack", "fullstack",
        "mobile", "mobile | ios | android | swift | kotlin | flutter",
        "data-ml", "ml | ai | nlp | scientist | analytics",
        "devops", "devops | sre | kubernetes | infrastructure | terraform | platform");

    private record Country(String value, String label) {}
    private static final List<Country> COUNTRIES = List.of(
        new Country("Germany", "독일"),
        new Country("Netherlands", "네덜란드"),
        new Country("United Kingdom", "영국"),
        new Country("Ireland", "아일랜드"));
```
그리고 기존 `search(...)` + `keywordSearch(...)` 두 메서드를 아래 하나로 교체:
```java
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        boolean hasQuery = q != null && !q.isBlank();
        String discTerms = discipline == null ? null : DISCIPLINE_TERMS.get(discipline);

        if (hasQuery || discTerms != null) {
            boolean byRelevance = hasQuery && !"recent".equals(sort);
            String qParam = hasQuery ? q.trim() : null;
            String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
            String locParam = (location != null && !location.isBlank())
                ? "%" + location.trim().toLowerCase() + "%" : null;
            int offset = (safePage - 1) * safeSize;

            List<String> ids = repository.searchIds(
                qParam, discTerms, visaParam, locParam, remote, byRelevance, safeSize, offset);
            long total = repository.countSearch(qParam, discTerms, visaParam, locParam, remote);

            Map<String, JobEntity> byId = new HashMap<>();
            for (JobEntity j : repository.findAllById(ids)) {
                byId.put(j.getId(), j);
            }
            List<JobDto> items = ids.stream()
                .map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
            return new JobListResponse(items, safePage, safeSize, total, computeFacets());
        }

        // q·discipline 없음: 기존 Specification 경로(최신순)
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

    public List<CountryCount> countryCounts() {
        return COUNTRIES.stream()
            .map(c -> new CountryCount(c.value(), c.label(),
                repository.countActiveByLocationLike("%" + c.value().toLowerCase() + "%")))
            .toList();
    }
```
(다른 메서드 listByCompany/findById/toDto/toDetailDto/computeFacets/preview 무변경.)

- [ ] **Step 3: JobController** — import `import com.devjobs.scout.dto.JobDtos.CountryCount;`, `import java.util.List;`. `list(...)` 에 discipline 추가 + `/countries` 엔드포인트:
```java
    @GetMapping
    public JobListResponse list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String visa,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) Boolean remote,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String discipline,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.search(q, visa, location, remote, sort, discipline, page, pageSize);
    }

    @GetMapping("/countries")
    public List<CountryCount> countries() {
        return service.countryCounts();
    }
```
(literal `/countries` 가 `@GetMapping("/{id:.+}")` 보다 우선 매칭 — Step 4 테스트/라이브로 확인.)

- [ ] **Step 4**: `cd backend && ./gradlew compileJava` → 성공. 커밋:
```bash
git add backend/src/main/java/com/devjobs/scout/JobRepository.java backend/src/main/java/com/devjobs/scout/dto/JobDtos.java backend/src/main/java/com/devjobs/scout/JobService.java backend/src/main/java/com/devjobs/scout/JobController.java
git commit -m "feat(search): 직무(discipline) 카테고리 필터 + 국가 건수 + 검색 쿼리 일반화"
```

---

## Task 3: JobSearchSelectorsTest (testcontainers)
**Create:** `backend/src/test/java/com/devjobs/scout/JobSearchSelectorsTest.java`
(JobSearchTest 와 동일 셋업: `@SpringBootTest @Testcontainers @Transactional`, pgvector 컨테이너, `@Autowired JobService service`, `JdbcTemplate jdbc`. 동일한 company()/job() 헬퍼 사용 — JobSearchTest 에서 복사.)

- [ ] **Step 1**: 작성
```java
package com.devjobs.scout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.scout.dto.JobDtos.CountryCount;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
import java.util.List;
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
class JobSearchSelectorsTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired JobService service;
    @Autowired JdbcTemplate jdbc;

    private void company(String slug, String name) {
        jdbc.update("INSERT INTO companies(slug, display_name) VALUES (?, ?)", slug, name);
    }

    private void job(String id, String title, String slug, String descText,
                     String tagsCsv, String location, boolean remote) {
        jdbc.update(
            "INSERT INTO jobs(id, source, title, company_slug, description_text, tags, location, is_remote, posted_at, is_active) "
          + "VALUES (?, 'test', ?, ?, ?, "
          + (tagsCsv == null ? "NULL" : "string_to_array(?, ',')")
          + ", ?, ?, now(), true)",
            tagsCsv == null
                ? new Object[]{ id, title, slug, descText, location, remote }
                : new Object[]{ id, title, slug, descText, tagsCsv, location, remote });
    }

    @Test
    void disciplineFiltersByCategory() {
        company("c1", "C1");
        job("be", "Backend Engineer", "c1", "x", "backend,go", "Berlin, Germany", false);
        job("fe", "Frontend Developer", "c1", "x", "react,ts", "Berlin, Germany", false);
        JobListResponse res = service.search(null, null, null, null, null, "backend", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("be")), "백엔드 매칭");
        assertTrue(res.items().stream().noneMatch(j -> j.id().equals("fe")), "프론트 제외");
    }

    @Test
    void disciplinePlusKeyword() {
        company("c2", "C2");
        job("a", "Backend Engineer", "c2", "kubernetes pipelines", "backend,kubernetes", "London", false);
        job("b", "Backend Engineer", "c2", "simple crud", "backend", "London", false);
        JobListResponse res = service.search("kubernetes", null, null, null, null, "backend", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("a")) && res.total() == 1,
            "직무+키워드 AND");
    }

    @Test
    void disciplineOnlyNoKeyword() {
        company("c3", "C3");
        job("d", "DevOps Engineer", "c3", "x", "kubernetes,terraform", "Dublin", false);
        JobListResponse res = service.search(null, null, null, null, null, "devops", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("d")), "키워드 없이 직무만으로 검색");
    }

    @Test
    void unknownDisciplineIgnored() {
        company("c4", "C4");
        job("z", "Whatever", "c4", "x", null, "Berlin", false);
        JobListResponse res = service.search(null, null, null, null, null, "bogus", 1, 20);
        assertTrue(res.total() >= 1, "알 수 없는 discipline 은 무시(기존 경로)");
    }

    @Test
    void countryCountsCorrect() {
        company("c5", "C5");
        job("g1", "Eng", "c5", "x", null, "Berlin, Germany", false);
        job("g2", "Eng", "c5", "x", null, "Munich, Germany", false);
        job("n1", "Eng", "c5", "x", null, "Amsterdam, Netherlands", false);
        List<CountryCount> cc = service.countryCounts();
        assertEquals(2L, cc.stream().filter(c -> c.value().equals("Germany")).findFirst().orElseThrow().count());
        assertEquals(1L, cc.stream().filter(c -> c.value().equals("Netherlands")).findFirst().orElseThrow().count());
    }
}
```

- [ ] **Step 2**: `cd backend && ./gradlew test --tests "com.devjobs.scout.JobSearchSelectorsTest"` → 통과(Docker 필요). 커밋:
```bash
git add backend/src/test/java/com/devjobs/scout/JobSearchSelectorsTest.java
git commit -m "test(search): discipline 필터/국가 건수 검증"
```

---

## Task 4: Dropdown UI 컴포넌트
**Create:** `web/components/ui/dropdown.tsx`
```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; count?: number };

export function Dropdown({
  placeholder,
  options,
  value,
  onSelect,
}: {
  placeholder: string;
  options: DropdownOption[];
  value: string | null;
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-body-sm",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full min-w-[12rem] overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-md">
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={cn(
              "flex w-full items-center px-3 py-1.5 text-body-sm hover:bg-accent",
              value === null && "font-medium text-primary",
            )}
          >
            전체
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onSelect(o.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-body-sm hover:bg-accent",
                value === o.value && "font-medium text-primary",
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.count !== undefined && (
                <span className="text-caption text-muted-foreground">{o.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```
- [ ] 타입체크 + 커밋:
```bash
cd web && npm run typecheck
git add web/components/ui/dropdown.tsx
git commit -m "feat(web-ui): Dropdown (선택 드롭다운)"
```

---

## Task 5: api.ts (discipline + fetchCountries) + page.tsx 배선
**Modify:** `web/lib/api.ts`, `web/app/search/page.tsx`

- [ ] **Step 1: api.ts** — `JobQuery` 에 `discipline?: string;` 추가. `fetchJobs` URL 빌드에 `if (query.discipline) url.searchParams.set("discipline", query.discipline);`. 파일 적절한 위치(다른 fetch 함수 옆)에 추가:
```ts
export type CountryCount = { value: string; label: string; count: number };

export async function fetchCountries(): Promise<CountryCount[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/countries`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as CountryCount[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: page.tsx** — import `fetchCountries`. `discipline` 읽고, countries 병렬 fetch, SearchBar 에 전달:
```tsx
  const discipline = str(searchParams.discipline);
  const [result, countries] = await Promise.all([
    fetchJobs({ q, visa, location, remote, sort, discipline, page, pageSize: PAGE_SIZE }),
    fetchCountries(),
  ]);
```
그리고 `<SearchBar />` → `<SearchBar countries={countries} />`. (import 에 fetchCountries 추가, 기존 fetchJobs import 옆.)

- [ ] **Step 3**: `cd web && npm run typecheck` → 에러 없음. 커밋:
```bash
git add web/lib/api.ts "web/app/search/page.tsx"
git commit -m "feat(web-search): discipline 파라미터 + 국가 건수 fetch 배선"
```

---

## Task 6: SearchBar 개편 (키워드+지역+직무+검색)
**Modify:** `web/components/search/SearchBar.tsx` (전체 교체)
```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { CountryCount } from "@/lib/api";
import { useUpdateQuery } from "@/lib/use-update-query";

const DISCIPLINES: DropdownOption[] = [
  { value: "backend", label: "백엔드" },
  { value: "frontend", label: "프론트엔드" },
  { value: "fullstack", label: "풀스택" },
  { value: "mobile", label: "모바일" },
  { value: "data-ml", label: "데이터·ML" },
  { value: "devops", label: "DevOps·인프라" },
];

export function SearchBar({ countries }: { countries: CountryCount[] }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const regionOptions: DropdownOption[] = countries.map((c) => ({
    value: c.value,
    label: c.label,
    count: c.count,
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: value.trim() || null });
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="python backend, react senior, ml engineer ..."
        aria-label="공고 검색"
        className="font-mono sm:flex-1"
      />
      <div className="sm:w-44">
        <Dropdown
          placeholder="지역 선택"
          options={regionOptions}
          value={searchParams.get("location")}
          onSelect={(v) => update({ location: v })}
        />
      </div>
      <div className="sm:w-44">
        <Dropdown
          placeholder="직무 선택"
          options={DISCIPLINES}
          value={searchParams.get("discipline")}
          onSelect={(v) => update({ discipline: v })}
        />
      </div>
      <Button type="submit">검색</Button>
    </form>
  );
}
```

- [ ] 타입체크 + 빌드 + 커밋:
```bash
cd web && npm run typecheck && npm run build
git add web/components/search/SearchBar.tsx
git commit -m "feat(web-search): 검색바에 지역/직무 선택 드롭다운 추가 (사람인식)"
```

---

## Task 7: 라이브 검증 (워크트리 스택, 격리 DB)
- [ ] 격리 DB `devjobs_wt4` 생성 → 백엔드(8081)+웹(3100). 시드: 여러 국가/태그/직무 공고 + 회사.
- [ ] `/api/v1/jobs/countries` (8081) → 국가별 건수 배열 (라우팅 확인, getOne 404 아님).
- [ ] `/search`: 지역 드롭다운(국가+건수) 선택 → location 필터; 직무 드롭다운 선택 → discipline 필터; 키워드+지역+직무 동시; 드롭다운 바깥클릭 닫힘. (Playwright)
- [ ] 검증 후 스택 종료 + `devjobs_wt4` DROP.

---

## Self-Review
- 스펙 커버리지: 지역 국가+건수(T1 count + T2 countryCounts + T6 dropdown) ✓, 직무 카테고리(T1 disc 쿼리 + T2 매핑 + T6) ✓, 쿼리 일반화(T1/T2) ✓, /countries(T2) ✓, Dropdown(T4) ✓, 배선(T5/T6) ✓.
- 타입 일관성: searchIds/countSearch 파라미터(q,disc,visa,loc,remote[,byRelevance,lim,off]) ↔ JobService 호출. discipline value(backend/frontend/...) ↔ DISCIPLINE_TERMS 키 ↔ 프론트 DISCIPLINES value. CountryCount(value,label,count) ↔ fetchCountries 타입 ↔ Dropdown 옵션. region value=국가명(Germany) ↔ location 필터.
- 회귀: q·discipline 없으면 기존 Specification 경로. 다른 service.search 호출부 없음(JobController만 — Task 2에서 확인). SearchFilters/SortToggle 무변경.
- 주의: /countries literal 우선 매칭 확인. 네이티브 null 파라미터 CAST. disc tsquery 토큰 서버 상수.
