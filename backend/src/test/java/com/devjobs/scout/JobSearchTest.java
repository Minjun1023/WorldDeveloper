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

    private void setVisa(String id, String status) {
        jdbc.update("UPDATE jobs SET visa_status = ? WHERE id = ?", status, id);
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
}
