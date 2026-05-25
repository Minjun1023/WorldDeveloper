package com.devjobs.auth;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.devjobs.auth.dto.AuthDtos.AuthResult;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final UserIdentityRepository identityRepo;
    private final EmailVerificationTokenRepository tokenRepo;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final JwtService jwtService;
    private final String appBaseUrl;

    public AuthService(UserRepository userRepo,
                       UserIdentityRepository identityRepo,
                       EmailVerificationTokenRepository tokenRepo,
                       PasswordEncoder passwordEncoder,
                       MailService mailService,
                       JwtService jwtService,
                       @Value("${app.base-url}") String appBaseUrl) {
        this.userRepo = userRepo;
        this.identityRepo = identityRepo;
        this.tokenRepo = tokenRepo;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.jwtService = jwtService;
        this.appBaseUrl = appBaseUrl;
    }

    private static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public void register(String email, String rawPassword, String displayName) {
        String norm = normalize(email);
        if (userRepo.findByEmail(norm).isPresent()) {
            return; // 계정 열거 방지: 조용히 반환
        }
        UserEntity u = new UserEntity(norm, passwordEncoder.encode(rawPassword), displayName);
        userRepo.save(u);
        issueAndSendVerification(u);
    }

    private void issueAndSendVerification(UserEntity u) {
        String raw = TokenHasher.randomToken();
        EmailVerificationTokenEntity t = new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(raw), OffsetDateTime.now().plusHours(24));
        tokenRepo.save(t);
        mailService.sendVerification(u.getEmail(), appBaseUrl + "/verify-email?token=" + raw);
    }

    @Transactional
    public void resendVerification(String email) {
        Optional<UserEntity> ou = userRepo.findByEmail(normalize(email));
        if (ou.isEmpty()) return;                       // 열거 방지
        UserEntity u = ou.get();
        if (u.getEmailVerifiedAt() != null) return;     // 이미 인증됨
        if (u.getPasswordHash() == null) return;         // OAuth 전용 계정 — 해당 없음
        tokenRepo.deleteByUserId(u.getId());             // 이전 토큰 정리
        issueAndSendVerification(u);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        EmailVerificationTokenEntity t = tokenRepo.findByTokenHash(TokenHasher.sha256Hex(rawToken))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token"));
        if (t.getConsumedAt() != null || t.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token");
        }
        UserEntity u = userRepo.findById(t.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token"));
        u.markEmailVerified(OffsetDateTime.now());
        t.consume(OffsetDateTime.now());
    }

    @Transactional(readOnly = true)
    public AuthResult login(String email, String rawPassword) {
        UserEntity u = userRepo.findByEmail(normalize(email))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials"));
        if (u.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
        }
        if (u.getEmailVerifiedAt() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "email_not_verified");
        }
        String token = jwtService.issue(u.getId().toString());
        return new AuthResult(token, u.getId().toString(), u.getEmail(), u.getDisplayName());
    }

    @Transactional
    public UserEntity oauthUpsert(String provider, String providerSub, String email, String displayName) {
        Optional<UserIdentityEntity> existingIdentity =
            identityRepo.findByProviderAndProviderSub(provider, providerSub);
        if (existingIdentity.isPresent()) {
            return userRepo.findById(existingIdentity.get().getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "user_missing"));
        }
        String norm = normalize(email);
        if (norm == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauth_email_required");
        }
        UserEntity user = userRepo.findByEmail(norm).orElse(null);
        if (user == null) {
            user = new UserEntity(norm, null, displayName); // OAuth 전용: password_hash = null
            user.markEmailVerified(OffsetDateTime.now());    // 공급자 검증분
            userRepo.save(user);
        }
        identityRepo.save(new UserIdentityEntity(user.getId(), provider, providerSub));
        return user;
    }
}
