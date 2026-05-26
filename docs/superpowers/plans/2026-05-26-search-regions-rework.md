# 지역 셀렉터 리워크 (도시 인식 + 글로벌 확장) 구현 계획

> 같은 워크트리 `worktree-search-selectors`(미머지)에서 지역 부분만 리워크. 직무(discipline)/Dropdown/검색 일반화는 유지.

**배경:** 실제 dev DB 929 활성 공고. location은 도시 자유텍스트("Berlin" 47, "San Francisco, CA" 25, "Remote" 51...). 기존 4국가 `location LIKE '%germany%'`는 (1) 지역이 너무 적고 (2) "Berlin" 같은 도시-only를 못 잡아 건수 누락. → 지역을 **정규식 패턴(도시+국가)** 으로, 목록을 글로벌 주요 지역으로 확장. 원격은 is_remote 기준.

**결정 지역:** 원격/미국/독일/영국/네덜란드/아일랜드/캐나다/프랑스.

---

## Task 1: 백엔드 — 지역 패턴 + region 파라미터 + /regions
**Modify:** `JobRepository.java`, `JobDtos.java`, `JobService.java`, `JobController.java`

- [ ] **JobRepository**: `searchIds`/`countSearch` 에 `regionRegex` 파라미터 추가 — WHERE 에 `AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))` (visa 조건 옆). 시그니처: `searchIds(q, disc, regionRegex, visa, loc, remote, byRelevance, lim, off)`, `countSearch(q, disc, regionRegex, visa, loc, remote)`. 그리고 카운트용 2개 추가:
```java
    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND is_remote = true", nativeQuery = true)
    long countActiveRemote();

    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND location ~* CAST(:regex AS text)",
        nativeQuery = true)
    long countActiveByLocationRegex(@Param("regex") String regex);
```
(`countActiveByLocationLike` 는 더 이상 안 쓰면 제거.)

- [ ] **JobDtos**: `CountryCount` → `RegionCount(String value, String label, long count)` 로 rename(필드 동일). (사용처 함께 수정.)

- [ ] **JobService**: `COUNTRIES`/`Country`/`countryCounts` 제거, 아래로 교체:
```java
    private record Region(String key, String label, String regex) {} // regex null = 원격(is_remote)
    private static final List<Region> REGIONS = List.of(
        new Region("remote", "원격", null),
        new Region("us", "미국", "united states|usa|san francisco|new york|san mateo|seattle|austin|boston|los angeles|bay area|mountain view|palo alto|chicago|denver"),
        new Region("germany", "독일", "germany|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf"),
        new Region("uk", "영국", "united kingdom|england|london|manchester|edinburgh|scotland"),
        new Region("netherlands", "네덜란드", "netherlands|amsterdam|rotterdam|utrecht|hague|eindhoven"),
        new Region("ireland", "아일랜드", "ireland|dublin|cork"),
        new Region("canada", "캐나다", "canada|toronto|vancouver|montreal|ottawa|waterloo"),
        new Region("france", "프랑스", "france|paris|lyon|toulouse"));

    public List<RegionCount> regionCounts() {
        return REGIONS.stream().map(r -> {
            long count = "remote".equals(r.key())
                ? repository.countActiveRemote()
                : repository.countActiveByLocationRegex(r.regex());
            return new RegionCount(r.key(), r.label(), count);
        }).toList();
    }
```
`search(...)` 시그니처에 `String region` 추가, native 경로 조건/파라미터 갱신:
```java
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, int page, int pageSize) {

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

        if (hasQuery || discTerms != null || regionRegex != null) {
            boolean byRelevance = hasQuery && !"recent".equals(sort);
            String qParam = hasQuery ? q.trim() : null;
            String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
            String locParam = (location != null && !location.isBlank())
                ? "%" + location.trim().toLowerCase() + "%" : null;
            int offset = (safePage - 1) * safeSize;

            List<String> ids = repository.searchIds(
                qParam, discTerms, regionRegex, visaParam, locParam, remoteParam, byRelevance, safeSize, offset);
            long total = repository.countSearch(qParam, discTerms, regionRegex, visaParam, locParam, remoteParam);

            Map<String, JobEntity> byId = new HashMap<>();
            for (JobEntity j : repository.findAllById(ids)) byId.put(j.getId(), j);
            List<JobDto> items = ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
            return new JobListResponse(items, safePage, safeSize, total, computeFacets());
        }

        // q·discipline·region(regex) 없음: 기존 Specification 경로(최신순) — remoteParam(원격 지역 포함) 적용
        Specification<JobEntity> spec = JobSpecifications.isActive();
        if (visa != null && !visa.isBlank()) spec = spec.and(JobSpecifications.visaStatus(visa.trim()));
        if (location != null && !location.isBlank()) spec = spec.and(JobSpecifications.location(location.trim()));
        if (remoteParam != null) spec = spec.and(JobSpecifications.remote(remoteParam));
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "postedAt"));
        Page<JobEntity> result = repository.findAll(spec, pageable);
        List<JobDto> items = result.getContent().stream().map(this::toDto).toList();
        return new JobListResponse(items, safePage, safeSize, result.getTotalElements(), computeFacets());
    }
```
import `RegionCount` (CountryCount 제거).

- [ ] **JobController**: `list(...)` 에 `@RequestParam(required=false) String region` 추가(discipline 다음) → `service.search(q, visa, location, remote, sort, discipline, region, page, pageSize)`. `@GetMapping("/countries")` → `@GetMapping("/regions")` 반환 `service.regionCounts()` (List<RegionCount>). import RegionCount.

- [ ] **테스트**: `JobSearchSelectorsTest` 의 countryCounts 테스트 → regionCounts 로 수정(시드에 "Berlin"(국가명 없음)도 독일로 잡히는지 검증: location='Berlin' job → region germany count 포함). `service.search(...)` 호출들에 `region`=null 인자 추가(시그니처 변경). 기존 `JobSearchTest` 의 `service.search` 호출에도 region=null 추가. 신규 테스트: region="germany" 선택 시 location='Berlin' 공고 매칭(도시 인식), region="remote" 시 is_remote=true 공고.
- [ ] `cd backend && ./gradlew test --tests "com.devjobs.scout.JobSearch*"` (양쪽) 통과. 커밋.

---

## Task 2: 프론트 — region 배선 + 드롭다운 + CountryTiles
**Modify:** `web/lib/api.ts`, `web/app/search/page.tsx`, `web/components/search/SearchBar.tsx`, `web/components/home/CountryTiles.tsx`

- [ ] **api.ts**: `JobQuery` 에 `region?: string` 추가, fetchJobs 에 `if (query.region) url.searchParams.set("region", query.region)`. `CountryCount`→`RegionCount` rename(타입 동일). `fetchCountries`→`fetchRegions` (경로 `/api/v1/jobs/regions`).
- [ ] **page.tsx**: `region = str(searchParams.region)` → fetchJobs 전달. `fetchRegions()` 결과를 `<SearchBar regions={regions} />`.
- [ ] **SearchBar**: prop `regions: RegionCount[]`. 지역 Dropdown options = regions(value=key,label,count), `value={searchParams.get("region")}`, `onSelect={(v)=>update({ region: v })}`. (직무 Dropdown 무변경.)
- [ ] **CountryTiles**(home): 4타일 링크를 `/search?region=germany|netherlands|uk|ireland` 로 변경(기존 `location=` → `region=`), 도시 인식 + 검색바와 일관.
- [ ] `cd web && npm run typecheck && npm run build` 성공. 커밋.

---

## Task 3: 라이브 검증
- [ ] 격리 DB 시드(도시-only 위치 포함: 'Berlin','San Francisco, CA','Remote' 등) → `/api/v1/jobs/regions` 건수 확인(Berlin이 독일에 잡히는지), 지역 드롭다운 선택 필터, 원격 선택→is_remote.

## Self-Review
- 지역=정규식 패턴(도시 인식) → 건수 정확·확장 ✓. region 파라미터 native 경로 + 원격은 remote 플래그 ✓. CountryTiles 일관 ✓. discipline/Dropbox/일반화 무변경. service.search 시그니처 변경 → 모든 호출부(Controller+테스트) region 인자 추가 필수.
