package com.devjobs.community;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

// 글 추천(사용자당 1회). 복합키(post_id, user_id) — coach_conversations 패턴.
@Entity
@Table(name = "community_reactions")
@IdClass(CommunityReaction.Key.class)
public class CommunityReaction {

    public static class Key implements Serializable {
        public UUID postId;
        public UUID userId;
        public Key() {}
        public Key(UUID postId, UUID userId) { this.postId = postId; this.userId = userId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return postId.equals(k.postId) && userId.equals(k.userId);
        }
        @Override public int hashCode() { return postId.hashCode() * 31 + userId.hashCode(); }
    }

    @Id @Column(name = "post_id") private UUID postId;
    @Id @Column(name = "user_id") private UUID userId;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected CommunityReaction() {}

    public CommunityReaction(UUID postId, UUID userId) {
        this.postId = postId;
        this.userId = userId;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getPostId() { return postId; }
    public UUID getUserId() { return userId; }
}
