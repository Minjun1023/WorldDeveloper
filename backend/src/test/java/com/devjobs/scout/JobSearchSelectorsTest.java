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

    /** country(ISO2)/city(슬러그) 지정 버전 — 지역 검색·집계는 ETL 이 채우는 이 컬럼 기반이다. */
    private void job(String id, String title, String slug, String location,
                     String country, String city) {
        jdbc.update(
            "INSERT INTO jobs(id, source, title, company_slug, description_text, location, country, city, "
          + "is_remote, posted_at, is_active) VALUES (?, 'test', ?, ?, 'x', ?, ?, ?, false, now(), true)",
            id, title, slug, location, country, city);
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
        // 지역 집계는 country(ISO2) 컬럼 GROUP BY — 도시-only location 의 국가 판정은
        // ETL(geo.detect_country)이 country 를 채우는 방식으로 책임이 이동했다.
        job("g0", "Eng", "c5", "Berlin", "de", "berlin");
        job("g1", "Eng", "c5", "Berlin, Germany", "de", "berlin");
        job("g2", "Eng", "c5", "Munich, Germany", "de", "munich");
        job("n1", "Eng", "c5", "Amsterdam, Netherlands", "nl", "amsterdam");
        List<RegionCount> rc = service.regionCounts();
        long germanyCount = rc.stream()
            .filter(r -> r.value().equals("de")).findFirst().orElseThrow().count();
        assertEquals(3L, germanyCount, "country=de 3건 집계");
        long netherlandsCount = rc.stream()
            .filter(r -> r.value().equals("nl")).findFirst().orElseThrow().count();
        assertEquals(1L, netherlandsCount);
    }

    @Test
    void regionSearchMatchesCityOnlyLocation() {
        company("c6", "C6");
        // region 값은 ISO2 국가("de") 또는 도시 슬러그("berlin") — country/city 컬럼과 매칭.
        job("city", "Engineer", "c6", "Berlin", "de", "berlin");
        job("country", "Engineer", "c6", "Berlin, Germany", "de", "berlin");
        JobListResponse byCountry = service.search(null, null, null, null, null, null, "de", 1, 20);
        assertTrue(byCountry.items().stream().anyMatch(j -> j.id().equals("city")),
            "country=de 검색이 도시-only location 공고도 반환(country 컬럼 기준)");
        assertTrue(byCountry.items().stream().anyMatch(j -> j.id().equals("country")));
        JobListResponse byCity = service.search(null, null, null, null, null, null, "berlin", 1, 20);
        assertTrue(byCity.items().stream().anyMatch(j -> j.id().equals("city")),
            "도시 슬러그 검색은 city 컬럼과 매칭");
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
        // 데이터 파생 설계: country 값이 있는 나라는 목록 고정 없이 전부 집계에 나타난다.
        job("es", "Eng", "c8", "Madrid, Spain", "es", "madrid");
        job("pl", "Eng", "c8", "Warsaw, Poland", "pl", "warsaw");
        job("se", "Eng", "c8", "Stockholm, Sweden", "se", "stockholm");
        job("it", "Eng", "c8", "Milan, Italy", "it", "milan");
        List<RegionCount> rc = service.regionCounts();
        for (String iso : List.of("es", "pl", "se", "it")) {
            assertTrue(rc.stream().anyMatch(r -> r.value().equals(iso)),
                "국가 '" + iso + "' 가 regionCounts 에 있어야 함");
        }
        long spainCount = rc.stream()
            .filter(r -> r.value().equals("es")).findFirst().orElseThrow().count();
        assertEquals(1L, spainCount, "Madrid 1건이 es 로 집계");
    }

    @Test
    void multiRegionSearchUnionsCountries() {
        company("c10", "C10");
        job("us1", "Eng", "c10", "San Francisco, USA", "us", "san-francisco");
        job("de1", "Eng", "c10", "Berlin, Germany", "de", "berlin");
        job("jp1", "Eng", "c10", "Tokyo, Japan", "jp", "tokyo");
        job("uk1", "Eng", "c10", "London, United Kingdom", "gb", "london");
        // region="us,de"(ISO2 콤마) → country IN (us, de) 유니온.
        JobListResponse res = service.search(null, null, null, null, null, null, "us,de", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("us1")), "미국 포함");
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("de1")), "독일 포함");
        assertTrue(res.items().stream().noneMatch(j -> j.id().equals("jp1")), "일본 제외");
        assertTrue(res.items().stream().noneMatch(j -> j.id().equals("uk1")), "영국 제외");
    }

    @Test
    void regionSearchMatchesNewCountryCityOnly() {
        company("c9", "C9");
        // 도시-only location 도 ETL 이 country/city 를 채우므로 국가·도시 검색 모두에 잡힌다.
        job("bcn", "Engineer", "c9", "Barcelona", "es", "barcelona");
        JobListResponse res = service.search(null, null, null, null, null, null, "es", 1, 20);
        assertTrue(res.items().stream().anyMatch(j -> j.id().equals("bcn")),
            "country=es 검색이 도시-only 'Barcelona' 공고 반환");
        JobListResponse byCity = service.search(null, null, null, null, null, null, "barcelona", 1, 20);
        assertTrue(byCity.items().stream().anyMatch(j -> j.id().equals("bcn")),
            "도시 슬러그 'barcelona' 검색 매칭");
    }
}
