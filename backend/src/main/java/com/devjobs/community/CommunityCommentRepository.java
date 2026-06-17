package com.devjobs.community;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, UUID> {

    List<CommunityComment> findByPostIdAndStatusOrderByCreatedAtAsc(UUID postId, String status);
}
