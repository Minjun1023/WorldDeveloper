package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendation_feedback")
public class RecommendationFeedbackEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "user_id") private UUID userId;
    @Column(name = "job_id") private String jobId;
    @Column private String action;
    @Column private Integer rank;
    @Column private Float score;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected RecommendationFeedbackEntity() {}
    public RecommendationFeedbackEntity(UUID userId, String jobId, String action, Integer rank, Float score) {
        this.userId = userId; this.jobId = jobId; this.action = action;
        this.rank = rank; this.score = score; this.createdAt = OffsetDateTime.now();
    }
    public Long getId() { return id; }
    public String getJobId() { return jobId; }
    public String getAction() { return action; }
}
