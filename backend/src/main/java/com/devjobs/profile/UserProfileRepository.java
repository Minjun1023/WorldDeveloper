package com.devjobs.profile;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileRepository extends JpaRepository<UserProfileEntity, UUID> {

    // 닉네임 중복 검사(대소문자 무시, 본인 제외).
    boolean existsByHandleIgnoreCaseAndUserIdNot(String handle, UUID userId);
}
