package com.devjobs.auth;

import java.time.OffsetDateTime;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final UserIdentityRepository identityRepo;
    private final EmailVerificationTokenRepository tokenRepo;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final String appBaseUrl;

    public AuthService(UserRepository userRepo,
                       UserIdentityRepository identityRepo,
                       EmailVerificationTokenRepository tokenRepo,
                       PasswordEncoder passwordEncoder,
                       MailService mailService,
                       @Value("${app.base-url}") String appBaseUrl) {
        this.userRepo = userRepo;
        this.identityRepo = identityRepo;
        this.tokenRepo = tokenRepo;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
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
}
