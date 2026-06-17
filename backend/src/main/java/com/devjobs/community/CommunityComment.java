package com.devjobs.community;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "community_comments")
public class CommunityComment {

    @Id private UUID id;
    @Column(name = "post_id") private UUID postId;
    @Column(name = "author_id") private UUID authorId;
    private String body;
    private boolean anonymous;
    private String status;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected CommunityComment() {}

    public CommunityComment(UUID postId, UUID authorId, String body, boolean anonymous) {
        this.id = UUID.randomUUID();
        this.postId = postId;
        this.authorId = authorId;
        this.body = body;
        this.anonymous = anonymous;
        this.status = "published";
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getPostId() { return postId; }
    public UUID getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public boolean isAnonymous() { return anonymous; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
