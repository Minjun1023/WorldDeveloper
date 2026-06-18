package com.devjobs.community;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

// 커뮤니티 글. id 는 앱에서 생성(UUID), 타임스탬프도 생성 시 설정.
@Entity
@Table(name = "community_posts")
public class CommunityPost {

    @Id private UUID id;
    @Column(name = "author_id") private UUID authorId;
    private String category;
    private String title;
    private String body;
    private boolean anonymous;
    @Column(name = "source_type") private String sourceType;
    @Column(name = "source_url") private String sourceUrl;
    @Column(name = "linked_company_slug") private String linkedCompanySlug;
    @Column(name = "linked_job_id") private String linkedJobId;
    @Column(name = "linked_country") private String linkedCountry;
    private String status;
    @Column(name = "comment_count") private int commentCount;
    private int score;
    @Column(name = "view_count") private int viewCount;
    @ElementCollection
    @CollectionTable(name = "community_post_tags", joinColumns = @JoinColumn(name = "post_id"))
    @Column(name = "tag")
    @BatchSize(size = 50)
    private List<String> tags = new ArrayList<>();
    @Column(name = "created_at") private OffsetDateTime createdAt;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    protected CommunityPost() {}

    public CommunityPost(UUID authorId, String category, String title, String body, boolean anonymous,
                         String sourceType, String sourceUrl, String linkedCompanySlug,
                         String linkedJobId, String linkedCountry, List<String> tags) {
        this.id = UUID.randomUUID();
        this.authorId = authorId;
        this.category = category;
        this.title = title;
        this.body = body;
        this.anonymous = anonymous;
        this.sourceType = sourceType;
        this.sourceUrl = sourceUrl;
        this.linkedCompanySlug = linkedCompanySlug;
        this.linkedJobId = linkedJobId;
        this.linkedCountry = linkedCountry;
        this.status = "published";
        this.commentCount = 0;
        this.score = 0;
        this.viewCount = 0;
        if (tags != null) this.tags.addAll(tags);
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getAuthorId() { return authorId; }
    public String getCategory() { return category; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public boolean isAnonymous() { return anonymous; }
    public String getSourceType() { return sourceType; }
    public String getSourceUrl() { return sourceUrl; }
    public String getLinkedCompanySlug() { return linkedCompanySlug; }
    public String getLinkedJobId() { return linkedJobId; }
    public String getLinkedCountry() { return linkedCountry; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public int getCommentCount() { return commentCount; }
    public void setCommentCount(int v) { this.commentCount = v; }
    public int getScore() { return score; }
    public void setScore(int v) { this.score = v; }
    public int getViewCount() { return viewCount; }
    public List<String> getTags() { return tags; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public void edit(String title, String body, List<String> tags) {
        this.title = title;
        this.body = body;
        this.tags.clear();
        if (tags != null) this.tags.addAll(tags);
        this.updatedAt = OffsetDateTime.now();
    }
}
