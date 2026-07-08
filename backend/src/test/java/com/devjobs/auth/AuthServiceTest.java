package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    @Autowired UserIdentityRepository identityRepo;

    @Test
    void registerCreatesUnverifiedUserAndSendsMail() {
        authService.register("New@Example.com", "Password123", "New User");

        UserEntity u = userRepo.findByEmail("new@example.com").orElseThrow();
        assertNotNull(u.getPasswordHash());
        assertTrue(u.getPasswordHash().startsWith("$2"), "BCrypt 해시");
        assertNull(u.getEmailVerifiedAt(), "가입 직후 미인증");
        verify(mailService, times(1)).sendVerificationCode(org.mockito.ArgumentMatchers.eq("new@example.com"),
            org.mockito.ArgumentMatchers.matches("\\d{6}"));
    }

    @Test
    void registerDuplicateEmailIsEnumerationSafeNoop() {
        authService.register("dup@example.com", "Password123", "A");
        org.mockito.Mockito.reset(mailService);
        // 같은 이메일 재가입 시도 → 예외 없이 조용히 null 반환(프로필 미부착), 메일 미발송
        java.util.UUID dup = authService.register("dup@example.com", "Otherpass456", "B");
        assertNull(dup, "중복 이메일 재가입은 null 반환 → 기존 계정에 프로필이 덮어써지지 않음");
        verifyNoMoreInteractions(mailService);
        assertEquals(1, userRepo.findByEmail("dup@example.com").stream().count());
    }

    @Test
    void verifyEmailMarksUserVerifiedAndConsumesToken() {
        authService.register("verify@example.com", "Password123", "V");
        // register 가 만든 코드의 원문은 메일로만 나가므로, 테스트는 새 코드를 직접 발급해 검증 경로를 탄다
        UserEntity u = userRepo.findByEmail("verify@example.com").orElseThrow();
        String code = "123456";
        tokenRepo.save(new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(code), "verify", java.time.OffsetDateTime.now().plusMinutes(10)));

        authService.verifyEmail("verify@example.com", code);

        assertNotNull(userRepo.findByEmail("verify@example.com").orElseThrow().getEmailVerifiedAt());
        // 단회용: 같은 코드 재사용 시 실패(소비됨)
        assertThrows(ResponseStatusException.class, () -> authService.verifyEmail("verify@example.com", code));
    }

    @Test
    void verifyEmailLocksAfterTooManyAttempts() {
        authService.register("brute@example.com", "Password123", "B");
        UserEntity u = userRepo.findByEmail("brute@example.com").orElseThrow();
        tokenRepo.deleteByUserIdAndPurpose(u.getId(), "verify");   // register 코드 제거 → 단일 활성 토큰
        String code = "654321";
        tokenRepo.save(new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(code), "verify", java.time.OffsetDateTime.now().plusMinutes(10)));

        // 5회 오답 — 매번 거부되면서 시도 누적
        for (int i = 0; i < 5; i++) {
            assertThrows(ResponseStatusException.class,
                () -> authService.verifyEmail("brute@example.com", "000000"));
        }
        // 한도 초과 후엔 '정답' 코드조차 잠겨 거부(429)
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.verifyEmail("brute@example.com", code));
        org.junit.jupiter.api.Assertions.assertEquals(429, ex.getStatusCode().value());
        // 이메일도 미인증 유지
        org.junit.jupiter.api.Assertions.assertNull(
            userRepo.findByEmail("brute@example.com").orElseThrow().getEmailVerifiedAt());
    }

    @Test
    void verifyEmailRejectsUnknownCode() {
        assertThrows(ResponseStatusException.class,
            () -> authService.verifyEmail("ghost@example.com", "000000"));
    }

    @Test
    void resendForUnverifiedUserSendsNewMail() {
        authService.register("resend@example.com", "Password123", "R");
        org.mockito.Mockito.reset(mailService);
        authService.resendVerification("resend@example.com");
        verify(mailService, times(1)).sendVerificationCode(
            org.mockito.ArgumentMatchers.eq("resend@example.com"),
            org.mockito.ArgumentMatchers.matches("\\d{6}"));
    }

    @Test
    void resendForUnknownEmailIsEnumerationSafeNoop() {
        authService.resendVerification("nobody@example.com"); // 예외 없음, 메일 없음
        verifyNoMoreInteractions(mailService);
    }

    @Test
    void loginSucceedsAfterVerification() {
        authService.register("login@example.com", "Password123", "L");
        UserEntity u = userRepo.findByEmail("login@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);

        AuthResult res = authService.login("login@example.com", "Password123");
        assertNotNull(res.token());
        assertEquals(u.getId().toString(), res.userId());
        assertEquals("login@example.com", res.email());
    }

    @Test
    void loginBlockedWhenEmailNotVerified() {
        authService.register("unverified@example.com", "Password123", "U");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("unverified@example.com", "Password123"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void loginRejectsWrongPassword() {
        authService.register("wrong@example.com", "Password123", "W");
        UserEntity u = userRepo.findByEmail("wrong@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("wrong@example.com", "nope"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void oauthUpsertCreatesNewUserWhenNoMatch() {
        AuthService.OAuthUpsertResult r = authService.oauthUpsert("google", "g-sub-1", "OAuth@Example.com", "OAuth User");
        UserEntity u = r.user();
        assertTrue(r.newAccount(), "최초 OAuth 가입 → 신규 계정");
        assertNotNull(u.getId());
        assertEquals("oauth@example.com", u.getEmail());
        assertNotNull(u.getEmailVerifiedAt(), "OAuth 이메일은 공급자 검증분 → 즉시 인증");
        assertTrue(identityRepo.findByProviderAndProviderSub("google", "g-sub-1").isPresent());
    }

    @Test
    void oauthUpsertReturnsExistingByIdentity() {
        AuthService.OAuthUpsertResult first = authService.oauthUpsert("github", "gh-1", "same@example.com", "X");
        AuthService.OAuthUpsertResult again = authService.oauthUpsert("github", "gh-1", "same@example.com", "X");
        assertEquals(first.user().getId(), again.user().getId());
        assertTrue(first.newAccount(), "1회차는 신규");
        assertFalse(again.newAccount(), "동일 provider 재로그인은 신규 아님 → 온보딩 미표시");
    }

    @Test
    void oauthUpsertLinksToExistingUserByVerifiedEmail() {
        authService.register("link@example.com", "Password123", "Link");
        UserEntity u = userRepo.findByEmail("link@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);
        AuthService.OAuthUpsertResult linked = authService.oauthUpsert("google", "g-link", "link@example.com", "Link");
        assertEquals(u.getId(), linked.user().getId());
        assertFalse(linked.newAccount(), "기존 이메일 계정에 provider 연결은 신규 아님 → 온보딩 미표시");
        assertTrue(identityRepo.findByProviderAndProviderSub("google", "g-link").isPresent());
    }

    @Test
    void registerRejectsDuplicateDisplayName() {
        authService.register("first@example.com", "Password123", "SameName");
        org.springframework.web.server.ResponseStatusException ex =
            org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> authService.register("second@example.com", "Password123", "SameName"));
        org.junit.jupiter.api.Assertions.assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void registerRejectsInvalidEmail() {
        org.springframework.web.server.ResponseStatusException ex =
            org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> authService.register("not-an-email", "Password123", "ValidName"));
        org.junit.jupiter.api.Assertions.assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void availabilityChecks() {
        authService.register("taken-mail@example.com", "Password123", "TakenName");
        org.junit.jupiter.api.Assertions.assertFalse(authService.isDisplayNameAvailable("TakenName"));
        org.junit.jupiter.api.Assertions.assertFalse(authService.isDisplayNameAvailable("takenname")); // 대소문자무시
        org.junit.jupiter.api.Assertions.assertTrue(authService.isDisplayNameAvailable("FreshName"));
        org.junit.jupiter.api.Assertions.assertFalse(authService.checkEmail("taken-mail@example.com").available());
        org.junit.jupiter.api.Assertions.assertTrue(authService.checkEmail("fresh-mail@example.com").available());
        org.junit.jupiter.api.Assertions.assertFalse(authService.checkEmail("bad-email").valid());
    }

    @Test
    void changePasswordUpdatesHashAndAllowsLoginWithNewPassword() {
        authService.register("chpw@example.com", "Password123", "C");
        UserEntity u = userRepo.findByEmail("chpw@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);

        authService.changePassword(u.getId(), "Password123", "NewPassword456");

        assertNotNull(authService.login("chpw@example.com", "NewPassword456").token());
        assertThrows(ResponseStatusException.class,
            () -> authService.login("chpw@example.com", "Password123")); // 옛 비번 무효
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        authService.register("chpw-wrong@example.com", "Password123", "W");
        UserEntity u = userRepo.findByEmail("chpw-wrong@example.com").orElseThrow();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.changePassword(u.getId(), "WrongPass999", "NewPassword456"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void changePasswordRejectsOAuthOnlyAccount() {
        AuthService.OAuthUpsertResult r =
            authService.oauthUpsert("google", "g-chpw", "chpw-oauth@example.com", "O");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.changePassword(r.user().getId(), null, "NewPassword456"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    void changePasswordRejectsWeakOrSameNewPassword() {
        authService.register("chpw-weak@example.com", "Password123", "K");
        UserEntity u = userRepo.findByEmail("chpw-weak@example.com").orElseThrow();

        assertThrows(ResponseStatusException.class,
            () -> authService.changePassword(u.getId(), "Password123", "short")); // 정책 위반
        ResponseStatusException same = assertThrows(ResponseStatusException.class,
            () -> authService.changePassword(u.getId(), "Password123", "Password123")); // 기존과 동일
        assertEquals(HttpStatus.BAD_REQUEST, same.getStatusCode());
    }
}
