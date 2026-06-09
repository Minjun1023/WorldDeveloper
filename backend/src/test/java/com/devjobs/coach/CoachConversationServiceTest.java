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
}
