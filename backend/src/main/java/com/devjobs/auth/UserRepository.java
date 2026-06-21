package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByDisplayNameIgnoreCase(String displayName);

    /** 최근 N일 가입 수(분석 퍼널용). */
    @Query(value = "SELECT count(*) FROM users WHERE created_at > now() - make_interval(days => :days)",
        nativeQuery = true)
    long countSince(@Param("days") int days);
}
