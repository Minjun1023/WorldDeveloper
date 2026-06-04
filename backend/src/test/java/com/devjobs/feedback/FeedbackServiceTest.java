package com.devjobs.feedback;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.auth.MailService;
import com.devjobs.feedback.dto.FeedbackDtos.FeedbackEvent;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest
class FeedbackServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean MailService mailService;

    @Autowired FeedbackService service;

    private UUID newUser() {
        return service.testInsertUser("fb_" + UUID.randomUUID() + "@example.com");
    }

    @Test
    void saveToggleIsIdempotentAndRemovable() {
        UUID u = newUser();
        service.save(u, "greenhouse:acme:1");
        service.save(u, "greenhouse:acme:1");
        assertEquals(List.of("greenhouse:acme:1"), service.interactions(u).saved());
        service.unsave(u, "greenhouse:acme:1");
        assertTrue(service.interactions(u).saved().isEmpty());
    }

    @Test
    void reactionUpsertAndDislikedIds() {
        UUID u = newUser();
        service.react(u, "j1", "like");
        service.react(u, "j1", "dislike");
        service.react(u, "j2", "dislike");
        assertEquals("dislike", service.interactions(u).reactions().get("j1"));
        assertTrue(service.dislikedJobIds(u).containsAll(List.of("j1", "j2")));
        service.clearReaction(u, "j1");
        assertFalse(service.dislikedJobIds(u).contains("j1"));
    }

    @Test
    void feedbackBulkInsertAccepted() {
        UUID u = newUser();
        long n = service.recordEvents(u, List.of(
            new FeedbackEvent("j1", "impression", 1, 0.8f),
            new FeedbackEvent("j2", "click", 2, 0.7f)));
        assertEquals(2, n);
    }

    @Test
    void unknownActionRejected() {
        UUID u = newUser();
        long n = service.recordEvents(u, List.of(new FeedbackEvent("j1", "BOGUS", 1, 0.5f)));
        assertEquals(0, n);
    }
}
