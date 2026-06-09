package com.devjobs.coach;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachConversationRepository
        extends JpaRepository<CoachConversationEntity, CoachConversationEntity.Key> {

    Optional<CoachConversationEntity> findByUserIdAndJobId(UUID userId, String jobId);

    void deleteByUserIdAndJobId(UUID userId, String jobId);

    int deleteByLastActiveAtBefore(OffsetDateTime cutoff);
}
