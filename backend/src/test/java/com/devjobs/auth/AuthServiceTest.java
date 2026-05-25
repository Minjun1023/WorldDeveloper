package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import org.springframework.web.server.ResponseStatusException;
import com.devjobs.auth.dto.AuthDtos.AuthResult;
import org.springframework.http.HttpStatus;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Transactional
class AuthServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean
    MailService mailService; // SMTP 회피

    @Autowired AuthService authService;
    @Autowired UserRepository userRepo;
    @Autowired EmailVerificationTokenRepository tokenRepo;

    @Test
    void registerCreatesUnverifiedUserAndSendsMail() {
        authService.register("New@Example.com", "password123", "New User");

        UserEntity u = userRepo.findByEmail("new@example.com").orElseThrow();
        assertNotNull(u.getPasswordHash());
        assertTrue(u.getPasswordHash().startsWith("$2"), "BCrypt 해시");
        assertNull(u.getEmailVerifiedAt(), "가입 직후 미인증");
        verify(mailService, times(1)).sendVerification(org.mockito.ArgumentMatchers.eq("new@example.com"),
            org.mockito.ArgumentMatchers.contains("/verify-email?token="));
    }

    @Test
    void registerDuplicateEmailIsEnumerationSafeNoop() {
        authService.register("dup@example.com", "password123", "A");
        org.mockito.Mockito.reset(mailService);
        // 같은 이메일 재가입 시도 → 예외 없이 조용히 반환, 메일 미발송
        authService.register("dup@example.com", "otherpass456", "B");
        verifyNoMoreInteractions(mailService);
        assertEquals(1, userRepo.findByEmail("dup@example.com").stream().count());
    }

    @Test
    void verifyEmailMarksUserVerifiedAndConsumesToken() {
        authService.register("verify@example.com", "password123", "V");
        // register 가 만든 토큰의 원문은 메일로만 나가므로, 테스트는 새 토큰을 직접 발급해 검증 경로를 탄다
        UserEntity u = userRepo.findByEmail("verify@example.com").orElseThrow();
        String raw = TokenHasher.randomToken();
        tokenRepo.save(new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(raw), java.time.OffsetDateTime.now().plusHours(1)));

        authService.verifyEmail(raw);

        assertNotNull(userRepo.findByEmail("verify@example.com").orElseThrow().getEmailVerifiedAt());
        // 단회용: 같은 토큰 재사용 시 실패
        assertThrows(ResponseStatusException.class, () -> authService.verifyEmail(raw));
    }

    @Test
    void verifyEmailRejectsUnknownToken() {
        assertThrows(ResponseStatusException.class, () -> authService.verifyEmail("deadbeef"));
    }

    @Test
    void resendForUnverifiedUserSendsNewMail() {
        authService.register("resend@example.com", "password123", "R");
        org.mockito.Mockito.reset(mailService);
        authService.resendVerification("resend@example.com");
        verify(mailService, times(1)).sendVerification(
            org.mockito.ArgumentMatchers.eq("resend@example.com"),
            org.mockito.ArgumentMatchers.contains("/verify-email?token="));
    }

    @Test
    void resendForUnknownEmailIsEnumerationSafeNoop() {
        authService.resendVerification("nobody@example.com"); // 예외 없음, 메일 없음
        verifyNoMoreInteractions(mailService);
    }

    @Test
    void loginSucceedsAfterVerification() {
        authService.register("login@example.com", "password123", "L");
        UserEntity u = userRepo.findByEmail("login@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);

        AuthResult res = authService.login("login@example.com", "password123");
        assertNotNull(res.token());
        assertEquals(u.getId().toString(), res.userId());
        assertEquals("login@example.com", res.email());
    }

    @Test
    void loginBlockedWhenEmailNotVerified() {
        authService.register("unverified@example.com", "password123", "U");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("unverified@example.com", "password123"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void loginRejectsWrongPassword() {
        authService.register("wrong@example.com", "password123", "W");
        UserEntity u = userRepo.findByEmail("wrong@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("wrong@example.com", "nope"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }
}
