package com.devjobs.coach;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import java.time.OffsetDateTime;
import java.util.List;
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
class CoachConversationServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired CoachConversationRepository repo;
    @Autowired CoachConversationService service;
    @Autowired JdbcTemplate jdbc;

    /** FK: coach_conversations.user_id → users(id) なので実ユーザーを先行挿入する */
    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?, ?, 'x', ?, now(), now())",
            id, "coach_test_" + id + "@example.com", "coach-" + id.toString().substring(0, 8));
        return id;
    }

    @Test
    void savesAndReadsMessagesAsJson() {
        UUID user = insertUser();
        var entity = new CoachConversationEntity(user, "job-1");
        entity.setMessages(List.of(new ChatMessage("user", "안녕"), new ChatMessage("assistant", "네")));
        entity.setLastActiveAt(OffsetDateTime.now());
        repo.save(entity);

        var found = repo.findByUserIdAndJobId(user, "job-1").orElseThrow();
        assertThat(found.getMessages()).hasSize(2);
        assertThat(found.getMessages().get(0).role()).isEqualTo("user");
        assertThat(found.getMessages().get(1).content()).isEqualTo("네");
    }

    @Test
    void saveUpsertsAndGetReturnsThread() {
        UUID user = insertUser();
        service.save(user, "job-2", List.of(new ChatMessage("user", "q1"), new ChatMessage("assistant", "a1")));
        service.save(user, "job-2", List.of(new ChatMessage("user", "q1"), new ChatMessage("assistant", "a1"),
            new ChatMessage("user", "q2"), new ChatMessage("assistant", "a2")));

        var got = service.get(user, "job-2").orElseThrow();
        assertThat(got.getMessages()).hasSize(4); // upsert: 같은 (user,job) 한 행
    }

    @Test
    void saveCapsAtLast200() {
        UUID user = insertUser();
        var many = new java.util.ArrayList<ChatMessage>();
        for (int i = 0; i < 250; i++) many.add(new ChatMessage("user", "m" + i));
        service.save(user, "job-3", many);

        var got = service.get(user, "job-3").orElseThrow();
        assertThat(got.getMessages()).hasSize(200);
        assertThat(got.getMessages().get(0).content()).isEqualTo("m50"); // 최근 200개
    }

    @Test
    void getFiltersExpiredOlderThan90Days() {
        UUID user = insertUser();
        var entity = new CoachConversationEntity(user, "job-old");
        entity.setMessages(List.of(new ChatMessage("user", "hi")));
        entity.setLastActiveAt(OffsetDateTime.now().minusDays(91));
        repo.save(entity);

        assertThat(service.get(user, "job-old")).isEmpty();
    }

    @Test
    void deleteRemovesConversation() {
        UUID user = insertUser();
        service.save(user, "job-4", List.of(new ChatMessage("user", "hi")));
        service.delete(user, "job-4");
        assertThat(service.get(user, "job-4")).isEmpty();
    }
}
