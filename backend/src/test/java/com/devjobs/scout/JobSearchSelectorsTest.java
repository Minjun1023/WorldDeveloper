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
