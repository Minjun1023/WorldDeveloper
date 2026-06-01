package com.devjobs.scout;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.scout.dto.JobDtos.JobListResponse;
import com.devjobs.scout.dto.JobDtos.RegionCount;
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
        JobListResponse res = service.search(null, null, null, null, null, "backend", null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("be")), "백엔드 매칭");
        assertTrue(res.items().stream().noneMatch(j -> j.id().equals("fe")), "프론트 제외");
    }

    @Test
    void disciplinePlusKeyword() {
        company("c2", "C2");
        job("a", "Backend Engineer", "c2", "kubernetes pipelines", "backend,kubernetes", "London", false);
        job("b", "Backend Engineer", "c2", "simple crud", "backend", "London", false);
        JobListResponse res = service.search("kubernetes", null, null, null, null, "backend", null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("a")) && res.total() == 1,
            "직무+키워드 AND");
    }

    @Test
    void disciplineOnlyNoKeyword() {
        company("c3", "C3");
        job("d", "DevOps Engineer", "c3", "x", "kubernetes,terraform", "Dublin", false);
        JobListResponse res = service.search(null, null, null, null, null, "devops", null, 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("d")), "키워드 없이 직무만으로 검색");
    }

    @Test
    void unknownDisciplineIgnored() {
        company("c4", "C4");
        job("z", "Whatever", "c4", "x", null, "Berlin", false);
        JobListResponse res = service.search(null, null, null, null, null, "bogus", null, 1, 20);
        assertTrue(res.total() >= 1, "알 수 없는 discipline 은 무시(기존 경로)");
    }

    @Test
    void regionCountsCorrect() {
        company("c5", "C5");
        // 도시-only (국가명 없음) → 독일 지역 패턴에 berlin 이 포함되므로 잡혀야 함
        job("g0", "Eng", "c5", "x", null, "Berlin", false);
        job("g1", "Eng", "c5", "x", null, "Berlin, Germany", false);
        job("g2", "Eng", "c5", "x", null, "Munich, Germany", false);
        job("n1", "Eng", "c5", "x", null, "Amsterdam, Netherlands", false);
        List<RegionCount> rc = service.regionCounts();
        // germany 패턴에 "berlin" 포함 → city-only "Berlin" 도 매칭 → count = 3
        long germanyCount = rc.stream()
            .filter(r -> r.value().equals("germany")).findFirst().orElseThrow().count();
        assertTrue(germanyCount >= 3,
            "도시-only 'Berlin' 이 독일 지역 패턴에 매칭되어야 함 (실제: " + germanyCount + ")");
        long netherlandsCount = rc.stream()
            .filter(r -> r.value().equals("netherlands")).findFirst().orElseThrow().count();
        assertEquals(1L, netherlandsCount);
    }

    @Test
    void regionSearchMatchesCityOnlyLocation() {
        company("c6", "C6");
        // location='Berlin' (국가명 없음) — region=germany 선택 시 잡혀야 함
        job("city", "Engineer", "c6", "x", null, "Berlin", false);
        job("country", "Engineer", "c6", "x", null, "Berlin, Germany", false);
        // region=germany → regionRegex 에 "berlin" 포함 → 도시-only 도 매칭
        JobListResponse res = service.search(null, null, null, null, null, null, "germany", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("city")),
            "city-only 'Berlin' 이 region=germany 검색에 매칭");
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("country")),
            "'Berlin, Germany' 도 매칭");
    }

    @Test
    void regionRemoteFiltersIsRemote() {
        company("c7", "C7");
        job("rem", "Remote Eng", "c7", "x", null, "Remote", true);
        job("onsite", "Onsite Eng", "c7", "x", null, "Berlin", false);
        // region=remote → remoteParam=true → Specification 경로 (regionRegex null)
        JobListResponse res = service.search(null, null, null, null, null, null, "remote", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("rem")),
            "region=remote 는 is_remote=true 공고를 반환");
        assertTrue(res.items().stream().noneMatch(j -> j.id().equals("onsite")),
            "onsite 공고는 제외");
    }

    @Test
    void newCountriesAppearInRegionCounts() {
        company("c8", "C8");
        job("es", "Eng", "c8", "x", null, "Madrid, Spain", false);
        job("pl", "Eng", "c8", "x", null, "Warsaw, Poland", false);
        job("se", "Eng", "c8", "x", null, "Stockholm, Sweden", false);
        job("it", "Eng", "c8", "x", null, "Milan, Italy", false);
        List<RegionCount> rc = service.regionCounts();
        // 확장된 9개국이 /regions 응답에 포함되어야 함
        for (String key : List.of("spain", "poland", "portugal", "sweden",
                "denmark", "italy", "austria", "czech", "switzerland")) {
            assertTrue(rc.stream().anyMatch(r -> r.value().equals(key)),
                "확장 국가 '" + key + "' 가 regionCounts 에 있어야 함");
        }
        long spainCount = rc.stream()
            .filter(r -> r.value().equals("spain")).findFirst().orElseThrow().count();
        assertEquals(1L, spainCount, "Madrid 가 spain 패턴에 매칭");
    }

    @Test
    void regionSearchMatchesNewCountryCityOnly() {
        company("c9", "C9");
        // 도시-only(국가명 없음) 도 region 검색에 잡혀야 함
        job("bcn", "Engineer", "c9", "x", null, "Barcelona", false);
        JobListResponse res = service.search(null, null, null, null, null, null, "spain", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("bcn")),
            "city-only 'Barcelona' 가 region=spain 검색에 매칭");
    }
}
