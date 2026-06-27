package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationTokenEntity, Long> {
    Optional<EmailVerificationTokenEntity> findByUserIdAndTokenHash(UUID userId, String tokenHash);
    Optional<EmailVerificationTokenEntity> findByUserIdAndTokenHashAndPurpose(
        UUID userId, String tokenHash, String purpose);
    // 코드와 무관하게 (user, purpose) 의 활성(미소비) 토큰 — 시도 횟수 누적/잠금용.
    // 운영은 발급 전 기존 토큰을 삭제해 1개뿐이지만, 안전하게 최신 id 우선.
    Optional<EmailVerificationTokenEntity> findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByIdDesc(
        UUID userId, String purpose);
    void deleteByUserId(UUID userId);
    void deleteByUserIdAndPurpose(UUID userId, String purpose);
}
