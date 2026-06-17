package com.devjobs.community;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityReactionRepository
        extends JpaRepository<CommunityReaction, CommunityReaction.Key> {

    boolean existsByPostIdAndUserId(UUID postId, UUID userId);

    void deleteByPostIdAndUserId(UUID postId, UUID userId);
}
