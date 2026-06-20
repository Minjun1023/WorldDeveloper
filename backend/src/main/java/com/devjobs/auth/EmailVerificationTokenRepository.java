package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationTokenEntity, Long> {
    Optional<EmailVerificationTokenEntity> findByUserIdAndTokenHash(UUID userId, String tokenHash);
    void deleteByUserId(UUID userId);
}
