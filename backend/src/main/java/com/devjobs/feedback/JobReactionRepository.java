package com.devjobs.feedback;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobReactionRepository extends JpaRepository<JobReactionEntity, JobReactionEntity.Key> {
    List<JobReactionEntity> findByUserId(UUID userId);
    List<JobReactionEntity> findByUserIdAndReaction(UUID userId, String reaction);
}
