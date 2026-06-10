package com.devjobs.company;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.company.dto.CompanyDtos.CompanyListResponse;
import com.devjobs.company.dto.CompanyDtos.CompanySummary;
import com.devjobs.scout.JobService;
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

/**
 * 회사 디렉터리 품질: 에이전시 제외(B) + 빈 큐레이션 태그의 공고기반 파생(A).
 * is_agency() 함수(V14) + 라이브 잡/회사 쿼리 필터 + CompanyService 태그 파생을 검증.
 */
@SpringBootTest
@Testcontainers
@Transactional
class CompanyDirectoryQualityTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired CompanyService companyService;
    @Autowired JobService jobService;
    @Autowired JdbcTemplate jdbc;

    /** tagsCsv=null 이면 큐레이션 태그 없음('{}'). */
    private void company(String slug, String name, String tagsCsv) {
        jdbc.update(
            "INSERT INTO companies(slug, display_name, tags) VALUES (?, ?, "
                + (tagsCsv == null ? "'{}'" : "string_to_array(?, ',')") + ")",
            tagsCsv == null ? new Object[] {slug, name} : new Object[] {slug, name, tagsCsv});
    }

    private void job(String id, String slug, String tagsCsv) {
        jdbc.update(
            "INSERT INTO jobs(id, source, title, company_slug, description_text, tags, is_remote, posted_at, is_active) "
                + "VALUES (?, 'test', 'Engineer', ?, 'desc', string_to_array(?, ','), false, now(), true)",
            id, slug, tagsCsv);
    }

    @Test
    void agencyCompaniesExcludedFromDirectory() {
        company("acme", "Acme", null);
        company("foo-personalberatung", "Foo Personalberatung", null); // 패턴
        company("angeheuert-gmbh", "Angeheuert", null); // 덴리스트
        job("a1", "acme", "go,python");
        job("p1", "foo-personalberatung", "go");
        job("d1", "angeheuert-gmbh", "java");

        CompanyListResponse res = companyService.list(null);
        List<String> slugs = res.items().stream().map(CompanySummary::slug).toList();
        assertThat(slugs).contains("acme");
        assertThat(slugs).doesNotContain("foo-personalberatung", "angeheuert-gmbh");
    }

    @Test
    void agencyJobsExcludedFromSearch() {
        company("realco", "RealCo", null);
        company("bar-recruiting", "Bar Recruiting", null); // 패턴(recruiting)
        job("r1", "realco", "kafka");
        job("x1", "bar-recruiting", "kafka");

        JobListResponse res = jobService.search("kafka", null, null, null, null, null, null, 1, 50);
        List<String> ids = res.items().stream().map(j -> j.id()).toList();
        assertThat(ids).contains("r1");
        assertThat(ids).doesNotContain("x1");
    }

    @Test
    void emptyCuratedTagsDerivedFromJobs() {
        company("startupx", "StartupX", null); // 큐레이션 태그 없음
        job("s1", "startupx", "python,aws,kubernetes");
        job("s2", "startupx", "python,aws,docker");

        CompanySummary c = companyService.list(null).items().stream()
            .filter(x -> x.slug().equals("startupx")).findFirst().orElseThrow();
        assertThat(c.tags()).contains("python", "aws"); // 빈도 상위
        assertThat(c.tags().size()).isLessThanOrEqualTo(4);
    }

    @Test
    void curatedTagsKeptOverDerived() {
        company("bigco", "BigCo", "fintech,payments"); // 큐레이션 있음
        job("b1", "bigco", "go,java,scala,rust"); // 공고 태그 많아도 큐레이션 유지

        CompanySummary c = companyService.list(null).items().stream()
            .filter(x -> x.slug().equals("bigco")).findFirst().orElseThrow();
        assertThat(c.tags()).containsExactly("fintech", "payments");
    }
}
