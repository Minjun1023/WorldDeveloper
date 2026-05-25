package com.devjobs.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OAuthHandoffCodeRepository extends JpaRepository<OAuthHandoffCodeEntity, Long> {
    Optional<OAuthHandoffCodeEntity> findByCodeHash(String codeHash);
}
