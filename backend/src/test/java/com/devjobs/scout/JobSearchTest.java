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
    @Autowired JobRepository repository;
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

    private void setVisa(String id, String status) {
        jdbc.update("UPDATE jobs SET visa_status = ? WHERE id = ?", status, id);
    }

    private void setRemote(String id, String eligibility) {
        jdbc.update("UPDATE jobs SET remote_eligibility = ? WHERE id = ?", eligibility, id);
    }

    /** closesSql: closes_at SQL 식 (예 "now() - interval '1 day'"). */
    private void setCloses(String id, String closesSql) {
        jdbc.update("UPDATE jobs SET closes_at = " + closesSql + " WHERE id = ?", id);
    }

    @Test
    void relevanceRanksTitleAboveDescription() {
        company("acme", "Acme Inc");
        job("j1", "Backend Engineer", "acme", "we use python", "backend,go", false, "now()");
        job("j2", "Data Analyst", "acme", "occasional backend chores", "sql", false, "now()");
        JobListResponse res = service.search("backend", null, null, null, null, null, null, 1, 20);
        assertTrue(res.total() >= 2, "둘 다 매칭");
        assertEquals("j1", res.items().get(0).id(), "제목 매칭이 설명 매칭보다 상위");
    }

    @Test
    void matchesCompanyName() {
        company("stripe", "Stripe");
        job("s1", "Software Engineer", "stripe", "build payments", "go", false, "now()");
        JobListResponse res = service.search("stripe", null, null, null, null, null, null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("s1")), "회사명으로 매칭");
    }

    @Test
    void matchesTag() {
        company("acme2", "Acme Two");
        job("t1", "Engineer", "acme2", "no keyword in text", "kubernetes,docker", false, "now()");
        JobListResponse res = service.search("kubernetes", null, null, null, null, null, null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("t1")), "태그로 매칭");
    }

    @Test
    void recentSortOrdersByPostedAt() {
        company("acme3", "Acme Three");
        job("old", "Backend Dev", "acme3", "x", "backend", false, "now() - interval '5 days'");
        job("new", "Backend Dev", "acme3", "x", "backend", false, "now()");
        setVisa("old", "sponsors");
        setVisa("new", "sponsors");  // 같은 비자 티어로 고정 → 티어 내부 최신순을 명시적으로 검증
        JobListResponse res = service.search("backend", null, null, null, "recent", null, null, 1, 20);
        assertEquals("new", res.items().get(0).id(), "같은 비자 티어 안에서 최신순이면 새 공고 먼저");
    }

    @Test
    void filterAppliesWithKeyword() {
        company("acme4", "Acme Four");
        job("r1", "Backend Engineer", "acme4", "x", "backend", true, "now()");
        job("r2", "Backend Engineer", "acme4", "x", "backend", false, "now()");
        JobListResponse res = service.search("backend", null, null, true, null, null, null, 1, 20);
        assertTrue(res.items().stream().allMatch(j -> j.id().equals("r1")) && res.total() == 1,
            "원격 필터 + 키워드 동시 적용");
    }

    @Test
    void recentRemoteViableCandidatesReturnsOnlyViableRemote() {
        company("rv2", "RV2 Co");
        job("cv_ww",  "Backend Engineer", "rv2", "x", "backend", true, "now()");
        job("cv_apac","Backend Engineer", "rv2", "x", "backend", true, "now()");
        job("cv_rr",  "Backend Engineer", "rv2", "x", "backend", true, "now()");
        job("cv_unc", "Backend Engineer", "rv2", "x", "backend", true, "now()");
        job("cv_on",  "Backend Engineer", "rv2", "x", "backend", false, "now()");
        setRemote("cv_ww", "worldwide");
        setRemote("cv_apac", "apac_ok");
        setRemote("cv_rr", "region_restricted");
        setRemote("cv_unc", "unclear");
        var ids = repository.findRecentRemoteViableCandidates(50).stream()
            .map(r -> (String) r[0]).filter(id -> id.startsWith("cv_")).toList();
        assertEquals(java.util.Set.of("cv_ww", "cv_apac"), new java.util.HashSet<>(ids),
            "원격 viable 후보 = worldwide·apac_ok 만 (region_restricted·unclear·onsite 제외)");
    }

    @Test
    void remoteFilterExcludesRegionRestricted() {
        company("rf", "RF Co");
        job("rf_ww",  "Backend Engineer", "rf", "x", "backend", true, "now()");
        job("rf_rr",  "Backend Engineer", "rf", "x", "backend", true, "now()");
        job("rf_unc", "Backend Engineer", "rf", "x", "backend", true, "now()");
        setRemote("rf_ww", "worldwide");
        setRemote("rf_rr", "region_restricted");
        // rf_unc: 원격이지만 eligibility 미설정(null) — region_restricted 아니므로 '원격만'에 포함
        JobListResponse res = service.search("backend", null, null, true, null, null, null, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("rf_")).toList();
        assertTrue(ids.contains("rf_ww") && ids.contains("rf_unc"),
            "'원격만' = worldwide·unclear 원격은 포함");
        assertTrue(!ids.contains("rf_rr"),
            "'원격만' = region_restricted 제외 (한국 거주자 원격 불가 — isKoreaViableRemote 와 동일 기준)");
    }

    @Test
    void noKeywordReturnsActiveJobs() {
        company("acme5", "Acme Five");
        job("n1", "Whatever", "acme5", "x", null, false, "now()");
        JobListResponse res = service.search(null, null, null, null, null, null, null, 1, 20);
        assertTrue(res.total() >= 1, "키워드 없으면 native 경로로 active 공고 반환(티어 정렬)");
    }

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
        job("nw_unc",  "Platform Engineer", "nw", "x", "backend", false, "now() - interval '1 days'");
        job("nw_no",   "Platform Engineer", "nw", "x", "backend", false, "now()");
        setVisa("nw_spon", "sponsors");
        setVisa("nw_no", "no_sponsor");
        // nw_unc 는 visa_status 미설정(NULL=unclear)
        JobListResponse res = service.search(null, null, null, null, "newest", null, null, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("nw_")).toList();
        assertEquals(java.util.List.of("nw_no", "nw_unc", "nw_spon"), ids,
            "newest 는 티어 무시, 순수 최신순(no_sponsor 최신 → unclear → sponsors 가장 오래됨)");
    }

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
    void expiredJobsExcludedRealtime() {
        company("exp", "Exp Co");
        job("e_live",    "Backend Engineer", "exp", "x", "backend", false, "now()");
        job("e_rolling", "Backend Engineer", "exp", "x", "backend", false, "now()"); // closes_at NULL = 상시채용
        job("e_dead",    "Backend Engineer", "exp", "x", "backend", false, "now()");
        setVisa("e_live", "sponsors");
        setVisa("e_rolling", "sponsors");
        setVisa("e_dead", "sponsors");
        setCloses("e_live", "now() + interval '7 days'"); // 마감 미래
        setCloses("e_dead", "now() - interval '1 day'");  // 마감 지남 → 실시간 제외

        JobListResponse res = service.search("backend", null, null, null, null, null, null, 1, 20);
        var ids = res.items().stream().map(j -> j.id()).filter(id -> id.startsWith("e_")).toList();
        assertTrue(ids.contains("e_live") && ids.contains("e_rolling"),
            "마감일 미래/없음 공고는 검색 노출");
        assertTrue(!ids.contains("e_dead"), "마감 지난 공고는 ETL 없이도 검색에서 즉시 제외");

        var byCompany = service.listByCompany("exp").stream().map(j -> j.id()).toList();
        assertEquals(java.util.Set.of("e_live", "e_rolling"), new java.util.HashSet<>(byCompany),
            "회사 공고 목록도 마감 지난 공고 제외");

        assertTrue(service.findById("e_live").isPresent(), "라이브 공고 단건 조회 가능");
        assertTrue(service.findById("e_dead").isEmpty(), "마감 지난 공고는 단건 조회도 제외");
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
}
