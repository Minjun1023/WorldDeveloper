package com.devjobs.feedback;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedJobRepository extends JpaRepository<SavedJobEntity, SavedJobEntity.Key> {
    List<SavedJobEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
