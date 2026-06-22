package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationTokenEntity, Long> {
    Optional<EmailVerificationTokenEntity> findByUserIdAndTokenHash(UUID userId, String tokenHash);
    Optional<EmailVerificationTokenEntity> findByUserIdAndTokenHashAndPurpose(
        UUID userId, String tokenHash, String purpose);
    void deleteByUserId(UUID userId);
    void deleteByUserIdAndPurpose(UUID userId, String purpose);
}
