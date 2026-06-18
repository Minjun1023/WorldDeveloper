package com.devjobs.community;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.community.dto.CommunityDtos.CreatePostRequest;
import com.devjobs.community.dto.CommunityDtos.FacetCount;
import com.devjobs.community.dto.CommunityDtos.PostDetail;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
class CommunityServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired CommunityService service;
    @Autowired JdbcTemplate jdbc;

    // 컨테이너 DB 는 클래스 내 테스트가 공유 → 메서드마다 글을 비워 카운트/필터를 결정적으로.
    // (community_post_tags/views/comments/reactions 는 ON DELETE CASCADE 로 함께 삭제)
    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM community_posts");
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?, ?, 'x', ?, now(), now())", id, "c_" + id + "@e.com", "c-" + id.toString().substring(0, 8));
        return id;
    }

    private PostDetail create(UUID u, String category, String title, String country, List<String> tags) {
        return service.create(u, new CreatePostRequest(
            category, title, "본문 내용입니다 — 충분히 길게.", false, "experience", null, null, null, country, tags));
    }

    private static long count(List<FacetCount> list, String key) {
        return list.stream().filter(f -> f.key().equals(key)).map(FacetCount::count).findFirst().orElse(0L);
    }

    @Test
    void createStoresTagsAndExposesInSummaryAndDetail() {
        UUID u = insertUser();
        PostDetail d = create(u, "visa", "독일 블루카드 후기", "germany", List.of("Blue Card", "Berlin"));
        assertThat(d.tags()).containsExactly("Blue Card", "Berlin");
        assertThat(d.viewCount()).isZero();

        var listed = service.list(null, null, null, null, null, null, false, "recent", 0, 20).items();
        assertThat(listed).anyMatch(p -> p.id().equals(d.id()) && p.tags().contains("Blue Card"));
    }

    @Test
    void normalizesTagsStripHashDedupeAndCap() {
        UUID u = insertUser();
        PostDetail d = create(u, "qna", "태그 정규화 확인", null,
            List.of("#Go", "go", "Rust", "Rust", "K8s", "Extra1", "Extra2"));
        // # 제거, 대소문자 무시 중복(go) 제거, 최대 5개.
        assertThat(d.tags()).containsExactly("Go", "Rust", "K8s", "Extra1", "Extra2");
    }

    @Test
    void facetsCountCategoriesCountriesAndTags() {
        UUID u = insertUser();
        create(u, "visa", "글A", "germany", List.of("Blue Card"));
        create(u, "visa", "글B", "germany", List.of("Blue Card", "EP"));
        create(u, "salary", "글C", "netherlands", List.of("30% ruling"));

        var f = service.facets();
        assertThat(count(f.categories(), "visa")).isEqualTo(2);
        assertThat(count(f.categories(), "salary")).isEqualTo(1);
        assertThat(count(f.countries(), "germany")).isEqualTo(2);
        assertThat(count(f.countries(), "netherlands")).isEqualTo(1);
        assertThat(count(f.tags(), "Blue Card")).isEqualTo(2);
        assertThat(count(f.tags(), "EP")).isEqualTo(1);
    }

    @Test
    void tagFilterReturnsOnlyMatching() {
        UUID u = insertUser();
        PostDetail withTag = create(u, "qna", "EP 질문", null, List.of("EP"));
        create(u, "qna", "무관한 글", null, List.of("Other"));

        var hits = service.list(null, null, null, null, "EP", null, false, "recent", 0, 20).items();
        assertThat(hits).extracting(p -> p.id()).containsExactly(withTag.id());
    }

    @Test
    void viewCountIncrementsOncePerUniqueViewer() {
        UUID u = insertUser();
        PostDetail d = create(u, "qna", "조회수 확인", null, List.of());

        service.registerView(d.id(), "ip:abc");
        service.registerView(d.id(), "ip:abc");   // 같은 열람자 — 중복 무시
        assertThat(service.get(d.id(), null).viewCount()).isEqualTo(1);

        service.registerView(d.id(), "ip:xyz");    // 다른 열람자 — +1
        assertThat(service.get(d.id(), null).viewCount()).isEqualTo(2);
    }
}
