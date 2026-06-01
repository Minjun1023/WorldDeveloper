# 원격 적격 백엔드 (viable 게이트 + track 필터 + 정렬) — Phase 2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 검색이 `remote_eligibility` 를 노출하고, 기본적으로 한국인이 취할 수 있는 공고(viable)만 보여주며, 이주/원격 트랙 필터와 원격 티어 정렬, "미확인 포함" 토글을 지원한다.

**Architecture:** 기존 `JobRepository.searchIds`/`countSearch` 네이티브 쿼리에 viability 게이트(`:gateMode`)와 원격 티어 정렬(`:remotePriority`)을 추가한다. `JobService.search` 가 `track`+`includeUnclear` 로 gateMode 를 계산해 넘긴다. `JobEntity`/DTO 에 `remote_eligibility`(+evidence)를 싣는다. Phase 1 의 V10 마이그레이션이 컬럼을 제공한다(Testcontainers Flyway 가 테스트 DB 에 자동 적용).

**Tech Stack:** Spring Boot (JPA + 네이티브 쿼리), Postgres, JUnit5 + Testcontainers. 작업 경로 `/Users/mac/WordDeveloper/WorldDeveloper/backend`. 브랜치 `feat/remote-eligibility-data-axis`.

**관련 문서:** spec `docs/superpowers/specs/2026-06-01-korea-viability-remote-eligibility-design.md`, Phase1 plan `docs/superpowers/plans/2026-06-01-remote-eligibility-data-axis.md`

**핵심 규칙 (viable 게이트):**
```
viable = (visa_status='sponsors') OR (remote_eligibility IN ('worldwide','apac_ok'))
gateMode = f(track, includeUnclear):
  track=null/both, includeUnclear=false → 'both'   : viable 만
  track=null/both, includeUnclear=true  → 'all'    : 전부(DB엔 확정막힘 없음)
  track=remote,    includeUnclear=false → 'remote' : remote_eligibility IN (worldwide,apac_ok)
  track=remote,    includeUnclear=true  → 'remote_unclear' : + 'unclear'
  track=relocation,includeUnclear=false → 'relocation' : visa_status='sponsors'
  track=relocation,includeUnclear=true  → 'relocation_unclear' : + 'unclear'
```

**빌드/테스트 명령:**
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew test
```
(Testcontainers 가 Docker 로 Postgres 를 띄움 — Docker 데몬 필요. 단일 테스트: `./gradlew test --tests 'com.devjobs.scout.JobSearchTest'`)

---

### Task 1: JobEntity 에 remote_eligibility 컬럼 매핑

**Files:**
- Modify: `backend/src/main/java/com/devjobs/domain/JobEntity.java`

- [ ] **Step 1: 필드 추가**

`visaEvidence` 필드 선언(line 68-70) 바로 아래에 추가:

```java
    @Column(name = "remote_eligibility")
    private String remoteEligibility;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "remote_evidence", columnDefinition = "jsonb")
    private List<String> remoteEvidence;
```

- [ ] **Step 2: getter 추가**

`getVisaEvidence()`(line 96) 바로 아래에 추가:

```java
    public String getRemoteEligibility() { return remoteEligibility; }
    public List<String> getRemoteEvidence() { return remoteEvidence; }
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add backend/src/main/java/com/devjobs/domain/JobEntity.java
git commit -m "feat(be): map remote_eligibility + remote_evidence on JobEntity"
```

---

### Task 2: DTO 노출 (RemoteDto + 응답/facet)

**Files:**
- Modify: `backend/src/main/java/com/devjobs/scout/dto/JobDtos.java`
- Modify: `backend/src/main/java/com/devjobs/scout/JobService.java`
- Modify: `backend/src/main/java/com/devjobs/scout/JobRepository.java`

- [ ] **Step 1: RemoteDto 레코드 + DTO 필드 추가**

`JobDtos.java` 에서 `VisaDto`(line 17) 아래에 추가:
```java
    public record RemoteDto(String eligibility, List<String> evidence) {}
```

`JobDto` 레코드의 `VisaDto visa,` 다음(line 33-34 사이)에 필드 추가 — `salary` 앞:
```java
        VisaDto visa,
        RemoteDto remote,
        SalaryDto salary
```
(기존 `VisaDto visa,` 와 `SalaryDto salary` 사이에 `RemoteDto remote,` 삽입)

`JobDetailDto` 레코드도 동일하게 `VisaDto visa,` 다음에 `RemoteDto remote,` 삽입 (line 51 `VisaDto visa,` 와 `SalaryDto salary` 사이).

`FacetsDto` 레코드에 필드 추가:
```java
    public record FacetsDto(
        Map<String, Long> visaStatus,
        Map<String, Long> isRemote,
        Map<String, Long> remoteEligibility
    ) {}
```

- [ ] **Step 2: Repository 에 facet 카운트 쿼리 추가**

`JobRepository.java` 의 `countByRemote()`(line 17-19) 아래에 추가:
```java
    @Query(value = "SELECT remote_eligibility, count(*) FROM jobs WHERE is_active = true GROUP BY remote_eligibility",
        nativeQuery = true)
    List<Object[]> countByRemoteEligibility();
```

- [ ] **Step 3: JobService 에 import 추가 + DTO 구성 반영**

`JobService.java` import 블록에 추가 (다른 `JobDtos.*` import 옆, 예 line 12 `import ...VisaDto;` 아래):
```java
import com.devjobs.scout.dto.JobDtos.RemoteDto;
```

`toDetailDto`(line 138 `return new JobDetailDto(`)에서 `visa,` 다음에 `remote` 를 끼운다. 먼저 `VisaDto visa = ...` 블록(line 127-129) 아래에 추가:
```java
        RemoteDto remote = new RemoteDto(j.getRemoteEligibility(), j.getRemoteEvidence());
```
그리고 `return new JobDetailDto(...)` 인자에서 `visa,` 다음에 `remote,` 삽입 (line 150 `visa,` 와 `salary);` 사이):
```java
            visa,
            remote,
            salary);
```

`toDto`(line 182 `return new JobDto(`)도 동일. `VisaDto visa = ...` 블록(line 174-176) 아래에 추가:
```java
        RemoteDto remote = new RemoteDto(j.getRemoteEligibility(), j.getRemoteEvidence());
```
`return new JobDto(...)` 인자에서 `visa,` 다음에 `remote,` 삽입 (line 194 `visa,` 와 `salary);` 사이):
```java
            visa,
            remote,
            salary);
```

`computeFacets()`(line 154-166) 에서 remote_eligibility 분포를 추가. `remote` 맵 빌드(line 160-164) 아래, `return new FacetsDto(...)` 직전에 추가:
```java
        Map<String, Long> remoteElig = new LinkedHashMap<>();
        for (Object[] row : repository.countByRemoteEligibility()) {
            remoteElig.put(row[0] == null ? "none" : row[0].toString(), ((Number) row[1]).longValue());
        }
```
그리고 return 을 변경:
```java
        return new FacetsDto(visa, remote, remoteElig);
```

- [ ] **Step 4: 컴파일 + 기존 테스트 그린 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew test`
Expected: BUILD SUCCESSFUL (기존 테스트 전부 통과 — DTO 에 필드만 추가, 동작 불변).

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add backend/src/main/java/com/devjobs/scout/dto/JobDtos.java backend/src/main/java/com/devjobs/scout/JobService.java backend/src/main/java/com/devjobs/scout/JobRepository.java
git commit -m "feat(be): expose remote_eligibility in JobDto/JobDetailDto/facets"
```

---

### Task 3: viable 게이트 + track 필터 + 원격 티어 정렬 배선

repository 쿼리·service 시그니처·controller 파라미터를 함께 바꾼다(한 묶음이라야 컴파일된다). 기존 9-arg `search` 는 게이트 미적용(`includeUnclear=true`) 오버로드로 남겨 기존 테스트를 건드리지 않는다.

**Files:**
- Modify: `backend/src/main/java/com/devjobs/scout/JobRepository.java`
- Modify: `backend/src/main/java/com/devjobs/scout/JobService.java`
- Modify: `backend/src/main/java/com/devjobs/scout/JobController.java`

- [ ] **Step 1: searchIds 쿼리에 게이트 + 원격 티어 추가**

`JobRepository.java` 의 `searchIds` 쿼리(line 43-65)를 통째로 교체:

```java
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
          AND (
            CAST(:gateMode AS text) = 'all'
            OR (CAST(:gateMode AS text) = 'both' AND (visa_status = 'sponsors' OR remote_eligibility IN ('worldwide','apac_ok')))
            OR (CAST(:gateMode AS text) = 'remote' AND remote_eligibility IN ('worldwide','apac_ok'))
            OR (CAST(:gateMode AS text) = 'remote_unclear' AND remote_eligibility IN ('worldwide','apac_ok','unclear'))
            OR (CAST(:gateMode AS text) = 'relocation' AND visa_status = 'sponsors')
            OR (CAST(:gateMode AS text) = 'relocation_unclear' AND visa_status IN ('sponsors','unclear'))
          )
        ORDER BY
          CASE WHEN :remotePriority THEN
            (CASE remote_eligibility WHEN 'worldwide' THEN 0 WHEN 'apac_ok' THEN 1 ELSE 2 END)
          ELSE 0 END ASC,
          CASE WHEN :visaPriority THEN
            (CASE visa_status WHEN 'sponsors' THEN 0 WHEN 'no_sponsor' THEN 2 ELSE 1 END)
          ELSE 0 END ASC,
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
          posted_at DESC NULLS LAST,
          id DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchIds(
        @Param("q") String q, @Param("disc") String disc, @Param("regionRegex") String regionRegex,
        @Param("visa") String visa, @Param("loc") String loc, @Param("remote") Boolean remote,
        @Param("gateMode") String gateMode, @Param("remotePriority") boolean remotePriority,
        @Param("visaPriority") boolean visaPriority, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);
```

- [ ] **Step 2: countSearch 쿼리에 동일 게이트 추가**

`JobRepository.java` 의 `countSearch` 쿼리(line 67-79)를 통째로 교체:

```java
    @Query(value = """
        SELECT count(*) FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
          AND (
            CAST(:gateMode AS text) = 'all'
            OR (CAST(:gateMode AS text) = 'both' AND (visa_status = 'sponsors' OR remote_eligibility IN ('worldwide','apac_ok')))
            OR (CAST(:gateMode AS text) = 'remote' AND remote_eligibility IN ('worldwide','apac_ok'))
            OR (CAST(:gateMode AS text) = 'remote_unclear' AND remote_eligibility IN ('worldwide','apac_ok','unclear'))
            OR (CAST(:gateMode AS text) = 'relocation' AND visa_status = 'sponsors')
            OR (CAST(:gateMode AS text) = 'relocation_unclear' AND visa_status IN ('sponsors','unclear'))
          )
        """, nativeQuery = true)
    long countSearch(
        @Param("q") String q, @Param("disc") String disc, @Param("regionRegex") String regionRegex,
        @Param("visa") String visa, @Param("loc") String loc, @Param("remote") Boolean remote,
        @Param("gateMode") String gateMode);
```

- [ ] **Step 3: JobService — 9-arg 오버로드 + 11-arg 본체로 교체**

`JobService.java` 의 `search` 메서드(line 71-108)를 통째로 아래로 교체:

```java
    // 기존 9-arg: 게이트 미적용(includeUnclear=true) 편의 오버로드 — 내부/테스트용.
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, int page, int pageSize) {
        return search(q, visa, location, remote, sort, discipline, region, null, true, page, pageSize);
    }

    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, String track, boolean includeUnclear, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        boolean hasQuery = q != null && !q.isBlank();
        String discTerms = discipline == null ? null : DISCIPLINE_TERMS.get(discipline);

        Region reg = (region == null) ? null
            : REGIONS.stream().filter(x -> x.key().equals(region)).findFirst().orElse(null);
        String regionRegex = (reg != null) ? reg.regex() : null;    // null for 원격/unknown
        Boolean remoteParam = remote;
        if (reg != null && "remote".equals(reg.key())) {
            remoteParam = Boolean.TRUE;                              // 원격 지역 → remote 필터
        }

        // viability 게이트 모드: track + includeUnclear 조합.
        String gateMode;
        if (includeUnclear) {
            gateMode = "remote".equals(track) ? "remote_unclear"
                     : "relocation".equals(track) ? "relocation_unclear" : "all";
        } else {
            gateMode = "remote".equals(track) ? "remote"
                     : "relocation".equals(track) ? "relocation" : "both";
        }

        // 정렬 1순위: remote 트랙이면 원격 티어, 아니면 비자 티어. sort=newest 면 둘 다 끔(순수 최신).
        boolean remotePriority = "remote".equals(track) && !"newest".equals(sort);
        boolean visaPriority = !"newest".equals(sort) && !"remote".equals(track);
        boolean byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort);
        String qParam = hasQuery ? q.trim() : null;
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchIds(
            qParam, discTerms, regionRegex, visaParam, locParam, remoteParam,
            gateMode, remotePriority, visaPriority, byRelevance, safeSize, offset);
        long total = repository.countSearch(
            qParam, discTerms, regionRegex, visaParam, locParam, remoteParam, gateMode);

        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) byId.put(j.getId(), j);
        List<JobDto> items = ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
        return new JobListResponse(items, safePage, safeSize, total, computeFacets());
    }
```

- [ ] **Step 4: JobController — track + include_unclear 파라미터 추가**

`JobController.java` 의 `list` 메서드(line 24-36)를 교체:

```java
    @GetMapping
    public JobListResponse list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String visa,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) Boolean remote,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String discipline,
        @RequestParam(required = false) String region,
        @RequestParam(required = false) String track,
        @RequestParam(name = "include_unclear", defaultValue = "false") boolean includeUnclear,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.search(q, visa, location, remote, sort, discipline, region,
            track, includeUnclear, page, pageSize);
    }
```

- [ ] **Step 5: 빌드 + 기존 테스트 전부 그린 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew test`
Expected: BUILD SUCCESSFUL. 기존 테스트는 9-arg 오버로드(gateMode='all')를 타므로 동작 불변 — 전부 통과해야 한다. 실패하면 9-arg 오버로드가 `includeUnclear=true` 로 위임하는지 확인.

- [ ] **Step 6: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add backend/src/main/java/com/devjobs/scout/JobRepository.java backend/src/main/java/com/devjobs/scout/JobService.java backend/src/main/java/com/devjobs/scout/JobController.java
git commit -m "feat(be): viable gate + track filter + remote tier sort (includeUnclear toggle)"
```

---

### Task 4: 게이트/트랙/티어 테스트

**Files:**
- Modify: `backend/src/test/java/com/devjobs/scout/JobSearchTest.java`

- [ ] **Step 1: remote_eligibility 세팅 헬퍼 추가**

`JobSearchTest.java` 의 `setVisa`(line 48-50) 아래에 추가:

```java
    private void setRemote(String id, String eligibility) {
        jdbc.update("UPDATE jobs SET remote_eligibility = ? WHERE id = ?", eligibility, id);
    }
```

- [ ] **Step 2: 게이트/트랙/티어 테스트 추가**

`JobSearchTest.java` 의 마지막 `}`(클래스 닫기) 직전에 추가:

```java
    @Test
    void defaultGateHidesNonViable() {
        company("g1", "Gate Co");
        job("g_spon", "Backend Engineer", "g1", "x", "backend", false, "now()");
        job("g_unc",  "Backend Engineer", "g1", "x", "backend", false, "now()");  // unclear, 비원격 → 비viable
        job("g_no",   "Backend Engineer", "g1", "x", "backend", false, "now()");
        setVisa("g_spon", "sponsors");
        setVisa("g_no", "no_sponsor");
        // g_unc 는 visa 미설정(unclear), remote 미설정(none)
        JobListResponse res = service.search(
            "backend", null, null, null, null, null, null, null, false, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("g_")).toList();
        assertEquals(java.util.List.of("g_spon"), ids, "기본 게이트는 viable(sponsors)만 노출");
    }

    @Test
    void includeUnclearRevealsHidden() {
        company("g2", "Gate Two");
        job("u_spon", "Backend Engineer", "g2", "x", "backend", false, "now()");
        job("u_unc",  "Backend Engineer", "g2", "x", "backend", false, "now()");
        setVisa("u_spon", "sponsors");
        // u_unc unclear/none → 기본 숨김, includeUnclear=true 면 노출
        JobListResponse res = service.search(
            "backend", null, null, null, null, null, null, null, true, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("u_")).toList();
        assertTrue(ids.contains("u_spon") && ids.contains("u_unc"),
            "includeUnclear=true 면 unclear 도 노출");
    }

    @Test
    void remoteViableShownWhenVisaUnclear() {
        company("g3", "Gate Three");
        job("rv", "Backend Engineer", "g3", "x", "backend", true, "now()");
        setRemote("rv", "worldwide");   // visa unclear 여도 worldwide 원격이면 viable
        JobListResponse res = service.search(
            "backend", null, null, null, null, null, null, null, false, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("rv")),
            "worldwide 원격이면 visa unclear 여도 viable");
    }

    @Test
    void remoteTrackFiltersToRemoteViable() {
        company("g4", "Gate Four");
        job("t_ww",  "Backend Engineer", "g4", "x", "backend", true, "now()");
        job("t_apac","Backend Engineer", "g4", "x", "backend", true, "now()");
        job("t_rr",  "Backend Engineer", "g4", "x", "backend", true, "now()");
        job("t_spon","Backend Engineer", "g4", "x", "backend", false, "now()");  // sponsors 지만 원격 아님
        setRemote("t_ww", "worldwide");
        setRemote("t_apac", "apac_ok");
        setRemote("t_rr", "region_restricted");
        setVisa("t_spon", "sponsors");
        JobListResponse res = service.search(
            "backend", null, null, null, null, null, null, "remote", false, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("t_")).toList();
        assertEquals(java.util.Set.of("t_ww", "t_apac"), new java.util.HashSet<>(ids),
            "remote 트랙은 worldwide/apac_ok 만 (region_restricted·비원격 sponsors 제외)");
    }

    @Test
    void remoteTrackOrdersWorldwideBeforeApac() {
        company("g5", "Gate Five");
        // posted_at: apac 가 더 최신 → 티어 없으면 apac 가 위로 올 것
        job("o_ww",   "Backend Engineer", "g5", "x", "backend", true, "now() - interval '1 days'");
        job("o_apac", "Backend Engineer", "g5", "x", "backend", true, "now()");
        setRemote("o_ww", "worldwide");
        setRemote("o_apac", "apac_ok");
        JobListResponse res = service.search(
            null, null, null, null, null, null, null, "remote", false, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("o_")).toList();
        assertEquals(java.util.List.of("o_ww", "o_apac"), ids,
            "remote 티어: worldwide → apac_ok (posted_at 역순이라도)");
    }

    @Test
    void relocationTrackFiltersToSponsors() {
        company("g6", "Gate Six");
        job("l_spon", "Backend Engineer", "g6", "x", "backend", false, "now()");
        job("l_ww",   "Backend Engineer", "g6", "x", "backend", true, "now()");   // 원격 viable 이지만 비자 스폰 아님
        setVisa("l_spon", "sponsors");
        setRemote("l_ww", "worldwide");
        JobListResponse res = service.search(
            "backend", null, null, null, null, null, null, "relocation", false, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("l_")).toList();
        assertEquals(java.util.List.of("l_spon"), ids,
            "relocation 트랙은 visa sponsors 만");
    }
```

- [ ] **Step 3: 테스트 실행 (신규 + 기존 전부 그린)**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew test --tests 'com.devjobs.scout.JobSearchTest'`
Expected: BUILD SUCCESSFUL — 기존 8개 + 신규 6개 통과.

- [ ] **Step 4: 전체 백엔드 테스트 그린 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/backend && ./gradlew test`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add backend/src/test/java/com/devjobs/scout/JobSearchTest.java
git commit -m "test(be): viable gate, includeUnclear, track filter + remote tier sort"
```

---

## Phase 2 완료 기준

- API 가 `track`(remote/relocation/null) + `include_unclear` 파라미터를 받는다.
- 기본 검색은 viable(sponsors OR worldwide/apac_ok)만 반환, `include_unclear=true` 면 unclear 도 노출.
- `track=remote` → 원격 viable 만 + 원격 티어 정렬, `track=relocation` → sponsors 만.
- 응답 DTO(JobDto/JobDetailDto)에 `remote { eligibility, evidence }` 포함, facets 에 remote_eligibility 분포 포함.
- 기존 테스트 무회귀(9-arg 오버로드) + 신규 테스트 그린.

## 주의 / 한계

- **DB 적용 시점:** V10 마이그레이션이 실제 운영 DB 에 적용되는 건 백엔드가 이 코드와 함께 부팅될 때다. 부팅 후 ETL 이 한 번 돌아야 컬럼이 채워진다(그 전엔 모든 remote_eligibility = NULL → remote 트랙/배지 비어 보임).
- **기존 visa 파라미터와 게이트 상호작용:** 사용자가 `visa=no_sponsor` 를 명시하면 게이트(both)와 AND 되어 결과가 거의 비게 된다. 이는 의도된 보수적 동작이며 `include_unclear=true` 로 우회 가능. 필요 시 후속에서 정책 조정.
- **facets 는 전체 active 분포(MVP)** — 현재 필터와 무관하게 집계(기존 동작 유지). 게이트 연동 facet 은 후속.

## 다음 단계 (Phase 3, 별도 계획)

웹: 소프트포크 랜딩(이주/원격/둘다 → track) + `RemoteBadge`(worldwide/apac_ok만) + "미확인 공고 포함" 토글(include_unclear) + 트랙 전환 + `web/lib/types.ts` 에 `remote` 필드.
