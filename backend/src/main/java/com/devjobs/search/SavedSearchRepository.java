package com.devjobs.search;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedSearchRepository extends JpaRepository<SavedSearchEntity, UUID> {
    List<SavedSearchEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<SavedSearchEntity> findByIdAndUserId(UUID id, UUID userId);
    void deleteByIdAndUserId(UUID id, UUID userId);
    List<SavedSearchEntity> findByNotifyTrue();
    Optional<SavedSearchEntity> findByUnsubscribeToken(UUID token);
}
