package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Transactional
class OAuthHandoffServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired OAuthHandoffService handoff;
    @Autowired UserRepository userRepo;

    @Test
    void createThenExchangeReturnsTokenOnce() {
        UserEntity u = userRepo.save(new UserEntity("handoff@example.com", null, "H"));
        String code = handoff.createCode(u.getId().toString());
        assertNotNull(code);

        AuthResult res = handoff.exchange(code);
        assertEquals(u.getId().toString(), res.userId());
        assertNotNull(res.token());

        // 단회용
        assertThrows(ResponseStatusException.class, () -> handoff.exchange(code));
    }

    @Test
    void exchangeRejectsUnknownCode() {
        assertThrows(ResponseStatusException.class, () -> handoff.exchange("nope"));
    }
}
