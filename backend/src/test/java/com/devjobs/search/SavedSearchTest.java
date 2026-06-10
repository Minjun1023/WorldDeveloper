package com.devjobs.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
class SavedSearchTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired SavedSearchRepository repo;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.devjobs.scout.JobService jobService;

    private void company(String slug) { jdbc.update("INSERT INTO companies(slug, display_name) VALUES (?, ?)", slug, slug); }
    // firstSeenSql: first_seen_at SQL 식 (예 "now()" 또는 "now() - interval '10 days'")
    private void job(String id, String slug, String title, String tagsCsv, String firstSeenSql) {
        jdbc.update("INSERT INTO jobs(id, source, title, company_slug, description_text, tags, is_remote, posted_at, first_seen_at, is_active, visa_status) "
            + "VALUES (?, 'test', ?, ?, 'desc', string_to_array(?, ','), false, now(), " + firstSeenSql + ", true, 'sponsors')",
            id, title, slug, tagsCsv);
    }

    UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?, ?, 'x', ?, now(), now())", id, "ss_" + id + "@e.com", "ss-" + id.toString().substring(0, 8));
        return id;
    }

    @Test
    void countMatchesSinceCountsOnlyNewerThanSince() {
        company("acme");
        job("old1", "acme", "Backend Engineer", "go", "now() - interval '10 days'");
        job("new1", "acme", "Backend Engineer", "go", "now() - interval '1 hour'");
        var params = new SavedSearchParams("backend", null, null, null, null, null, null, null, false);
        long recent = jobService.countMatchesSince(params, java.time.OffsetDateTime.now().minusDays(5));
        assertThat(recent).isEqualTo(1);  // new1 only
        long all = jobService.countMatchesSince(params, java.time.OffsetDateTime.now().minusDays(365));
        assertThat(all).isEqualTo(2);     // both
    }

    @Test
    void savesAndReadsParamsAsJson() {
        UUID u = insertUser();
        var e = new SavedSearchEntity(u, "react · 독일",
            new SavedSearchParams("react", null, null, null, null, "backend", "germany", "relocation", false));
        repo.save(e);
        var got = repo.findByUserIdOrderByCreatedAtDesc(u);
        assertThat(got).hasSize(1);
        assertThat(got.get(0).getLabel()).isEqualTo("react · 독일");
        assertThat(got.get(0).getParams().q()).isEqualTo("react");
        assertThat(got.get(0).getParams().region()).isEqualTo("germany");
    }
}
