# Sponsor-First Ordering + Home Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make visa-sponsor jobs the default star of the site — search results sort by visa tier (sponsors → unclear → no_sponsor) and the home page leads with the sponsor section.

**Architecture:** Add a leading visa-tier `CASE` to the existing native search query (`JobRepository.searchIds`), gated by a `:visaPriority` flag, and route ALL searches through that native path (every filter is already optional), removing the old Specification branch. Frontend reorders the home page to put the sponsor section first with a count, and requests the "newest" showcase with a tier-bypassing `sort=newest`.

**Tech Stack:** Spring Boot (Java) + JPA native query + Postgres FTS; Next.js 14 (TS) App Router; testcontainers (pgvector/pgvector:pg16).

---

## Background the engineer needs

- `JobService.search(q, visa, location, remote, sort, discipline, region, page, pageSize)` currently has TWO paths: a native path (`searchIds`/`countSearch`) used when `q`/`discipline`/`region` is present, and a JPA Specification path (`repository.findAll(spec, Sort.by(postedAt DESC))`) used otherwise (default browse + the home `visa=sponsors` fetch).
- `searchIds` already accepts every filter as optional (`q`, `disc`, `regionRegex`, `visa`, `loc`, `remote`) — so the Specification path is redundant and can be replaced by the native path.
- `JobController` already passes `sort` through as a `@RequestParam(required = false)`. No controller change needed.
- Visa values stored in `jobs.visa_status`: `'sponsors'`, `'no_sponsor'`, `'unclear'`, or `NULL` (treat NULL as unclear — it falls into the CASE `ELSE` branch).
- Sort contract (after this change):
  | `sort` | ordering |
  |---|---|
  | (absent) | visa-tier, posted_at DESC, id DESC |
  | `relevance` | visa-tier, ts_rank DESC, posted_at DESC, id DESC |
  | `recent` | visa-tier, posted_at DESC, id DESC |
  | `newest` | **no tier**, posted_at DESC, id DESC (home "새로 올라온 공고" only) |

---

## File Structure

- `backend/src/main/java/com/devjobs/scout/JobRepository.java` — add `:visaPriority` param + tier `CASE` to `searchIds` ORDER BY.
- `backend/src/main/java/com/devjobs/scout/JobService.java` — unify on native path; compute `visaPriority`/`byRelevance`; remove Specification branch + now-unused imports.
- `backend/src/test/java/com/devjobs/scout/JobSearchTest.java` — add visa-tier ordering test + newest-bypass test + `setVisa` helper; fix one stale comment.
- `web/components/home/SectionHeader.tsx` — add optional `count?: number` prop.
- `web/app/page.tsx` — reorder sections (sponsor section first), pass `count`, request latest with `sort: "newest"`.

---

### Task 1: Backend — visa-tier ordering + unified search path

**Files:**
- Modify: `backend/src/main/java/com/devjobs/scout/JobRepository.java`
- Modify: `backend/src/main/java/com/devjobs/scout/JobService.java`
- Test: `backend/src/test/java/com/devjobs/scout/JobSearchTest.java`

- [ ] **Step 1: Add the failing tests + helper to `JobSearchTest.java`**

Add this helper method inside the class (after the existing `job(...)` method, before `@Test void relevanceRanksTitleAboveDescription()`):

```java
    private void setVisa(String id, String status) {
        jdbc.update("UPDATE jobs SET visa_status = ? WHERE id = ?", status, id);
    }
```

Add these two test methods at the end of the class (before the closing `}`):

```java
    @Test
    void visaPriorityOrdersSponsorsFirst() {
        company("vp", "VP Co");
        // posted_at: no_sponsor 가 가장 최신 → 티어가 없으면 no_sponsor 가 맨 위로 올 것
        job("vp_spon", "Platform Engineer", "vp", "x", "backend", false, "now() - interval '2 days'");
        job("vp_unc",  "Platform Engineer", "vp", "x", "backend", false, "now() - interval '1 days'");
        job("vp_no",   "Platform Engineer", "vp", "x", "backend", false, "now()");
        setVisa("vp_spon", "sponsors");
        setVisa("vp_unc", "unclear");
        setVisa("vp_no", "no_sponsor");
        JobListResponse res = service.search(null, null, null, null, null, null, null, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("vp_")).toList();
        assertEquals(java.util.List.of("vp_spon", "vp_unc", "vp_no"), ids,
            "비자 티어: 스폰서 → unclear → no_sponsor (posted_at 역순이라도)");
    }

    @Test
    void newestSortBypassesVisaTier() {
        company("nw", "NW Co");
        job("nw_spon", "Platform Engineer", "nw", "x", "backend", false, "now() - interval '2 days'");
        job("nw_no",   "Platform Engineer", "nw", "x", "backend", false, "now()");
        setVisa("nw_spon", "sponsors");
        setVisa("nw_no", "no_sponsor");
        JobListResponse res = service.search(null, null, null, null, "newest", null, null, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("nw_")).toList();
        assertEquals(java.util.List.of("nw_no", "nw_spon"), ids,
            "newest 는 티어 무시, 순수 최신순(no_sponsor 가 더 최신이라 먼저)");
    }
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `cd backend && ./gradlew test --tests 'com.devjobs.scout.JobSearchTest.visaPriorityOrdersSponsorsFirst'`
Expected: FAIL — actual order is `[vp_no, vp_unc, vp_spon]` (current default path is posted_at DESC, no tier).

- [ ] **Step 3: Add `:visaPriority` param + tier CASE to `JobRepository.searchIds`**

In `JobRepository.java`, replace the `searchIds` `@Query` ORDER BY and method signature. The new `@Query` block:

```java
    // 풀텍스트 검색(키워드 q + 직무 disc + 지역 regionRegex 모두 optional). disc 는 서버 큐레이션 tsquery 문자열.
    // visaPriority=true 면 비자 티어(sponsors→unclear→no_sponsor)를 1순위로 정렬한다.
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        ORDER BY
          CASE WHEN :visaPriority THEN
            (CASE visa_status WHEN 'sponsors' THEN 0 WHEN 'no_sponsor' THEN 2 ELSE 1 END)
          ELSE 0 END,
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
          posted_at DESC NULLS LAST,
          id DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchIds(
        @Param("q") String q, @Param("disc") String disc, @Param("regionRegex") String regionRegex,
        @Param("visa") String visa, @Param("loc") String loc, @Param("remote") Boolean remote,
        @Param("visaPriority") boolean visaPriority, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);
```

(Leave `countSearch` unchanged — ordering does not affect counts.)

- [ ] **Step 4: Unify `JobService.search` on the native path**

In `JobService.java`, replace the entire `search(...)` method body (the current lines from `int safePage = ...` through the `return new JobListResponse(...)` of the Specification branch) with:

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

        // 비자 우선 티어가 기본. sort=newest 일 때만 끔(홈 "새로 올라온 공고" 순수 최신 쇼케이스).
        boolean visaPriority = !"newest".equals(sort);
        boolean byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort);
        String qParam = hasQuery ? q.trim() : null;
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchIds(
            qParam, discTerms, regionRegex, visaParam, locParam, remoteParam,
            visaPriority, byRelevance, safeSize, offset);
        long total = repository.countSearch(qParam, discTerms, regionRegex, visaParam, locParam, remoteParam);

        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) byId.put(j.getId(), j);
        List<JobDto> items = ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
        return new JobListResponse(items, safePage, safeSize, total, computeFacets());
    }
```

- [ ] **Step 5: Remove now-unused imports from `JobService.java`**

Delete these five import lines (they were only used by the removed Specification branch):

```java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
```

Keep all other imports (`HashMap`, `LinkedHashMap`, `List`, `Map`, `Objects`, `Optional`, `JobEntity`, DTO imports). `JobSpecifications` is in the same package and was referenced without an import, so there is no import line to remove; the class file stays as-is (harmless; deleting it is out of scope).

- [ ] **Step 6: Fix the stale comment in `noKeywordReturnsActiveJobs`**

In `JobSearchTest.java`, change the assertion message of `noKeywordReturnsActiveJobs` from `"키워드 없으면 기존 경로로 active 공고 반환"` to `"키워드 없으면 native 경로로 active 공고 반환(티어 정렬)"`.

- [ ] **Step 7: Run the new + regression tests to verify they pass**

Run: `cd backend && ./gradlew test --tests 'com.devjobs.scout.JobSearchTest' --tests 'com.devjobs.scout.JobSearchSelectorsTest'`
Expected: PASS (all of `JobSearchTest` incl. the 2 new methods, and all `JobSearchSelectorsTest`).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/devjobs/scout/JobRepository.java backend/src/main/java/com/devjobs/scout/JobService.java backend/src/test/java/com/devjobs/scout/JobSearchTest.java
git commit -m "feat(search): visa-tier ordering (sponsors first) + unify on native path"
```

---

### Task 2: Frontend — home elevation + sponsor count

**Files:**
- Modify: `web/components/home/SectionHeader.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Add `count` prop to `SectionHeader`**

Replace the whole component in `web/components/home/SectionHeader.tsx` with:

```tsx
import Link from "next/link";

type Accent = "visa" | "recommend";

const DOT: Record<Accent, string> = {
  visa: "bg-success",
  recommend: "bg-primary",
};

export function SectionHeader({
  title,
  accent,
  href,
  hrefLabel = "전체 보기",
  count,
}: {
  title: string;
  accent?: Accent;
  href?: string;
  hrefLabel?: string;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="flex items-center gap-2 text-h2">
        {accent && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[accent]}`}
            aria-hidden
          />
        )}
        {title}
        {count !== undefined && (
          <span className="text-body-sm font-normal text-muted-foreground">{count}개</span>
        )}
      </h2>
      {href && (
        <Link href={href} className="text-body-sm text-primary hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reorder home sections + count + newest sort**

Replace the whole `HomePage` component body in `web/app/page.tsx` with (imports at top stay the same):

```tsx
export default async function HomePage() {
  const [visaRes, latestRes, companies, regions] = await Promise.all([
    fetchJobs({ visa: "sponsors", pageSize: 8 }),
    fetchJobs({ pageSize: 6, sort: "newest" }),
    fetchCompanies(),
    fetchRegions(),
  ]);

  const visaJobs = visaRes.ok ? visaRes.data.items : [];
  const visaTotal = visaRes.ok ? visaRes.data.total : 0;
  const latestJobs = latestRes.ok ? latestRes.data.items : [];
  const spotlight = companies?.items.slice(0, 6) ?? [];

  return (
    <div className="space-y-12">
      <Hero regions={regions} />

      {visaJobs.length > 0 && (
        <section>
          <SectionHeader title="비자 스폰서십 공고" accent="visa" count={visaTotal} href="/search?visa=sponsors" />
          <JobScrollRow jobs={visaJobs} />
        </section>
      )}

      <section>
        <SectionHeader title="나에게 맞는 공고" accent="recommend" href="/recommend" hrefLabel="정교한 추천 설정" />
        <NlRecommend />
      </section>

      <section>
        <SectionHeader title="국가별로 찾기" />
        <CountryTiles />
      </section>

      {latestJobs.length > 0 && (
        <section>
          <SectionHeader title="새로 올라온 공고" href="/search" hrefLabel="더 보기" />
          <JobScrollRow jobs={latestJobs} />
        </section>
      )}

      {spotlight.length > 0 && (
        <section>
          <SectionHeader title="주목할 회사" href="/companies" hrefLabel="회사 디렉터리" />
          <CompanySpotlight companies={spotlight} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/home/SectionHeader.tsx web/app/page.tsx
git commit -m "feat(home): lead with sponsor section + count, newest showcase bypasses tier"
```

---

## Live verification (after both tasks, run by the controller — not a code task)

On an isolated clone of real `devjobs` plus the worktree web on port 3001 against the running backend:
1. `/search` (no params): first page starts with "스폰서 가능" badge jobs; "스폰서 불가" jobs appear only at the end.
2. `/search?q=backend`: sponsors float to the top of the matching set; relevance/recent toggle still works within tiers.
3. Home: top section under the hero is "비자 스폰서십 공고 N개"; "새로 올라온 공고" is pure-newest (sponsors not floated).

---

## Self-Review notes

- **Spec coverage:** §1 ordering → Task 1 (tier CASE + visaPriority + path unification + sort contract). §2 home elevation → Task 2 (reorder + count + `sort=newest`). §3 non-goals respected (no visa chips, no /sponsors page, no no_sponsor hiding). §4 testing → Task 1 Steps 1-7 (tier + newest + regression) and the live-verification section.
- **Type consistency:** `searchIds` gains `@Param("visaPriority") boolean visaPriority` in both `@Query` and signature; `JobService` passes the args in the matching order (`...remoteParam, visaPriority, byRelevance, safeSize, offset`). `SectionHeader` `count?: number` matches `visaTotal` (number). `JobQuery.sort` is already `string`, so `sort: "newest"` needs no type change.
- **No placeholders:** every code step contains full code.
