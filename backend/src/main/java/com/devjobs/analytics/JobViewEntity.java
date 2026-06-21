package com.devjobs.analytics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** 공고 조회 1건(고유 열람자/일 기준). 기록은 native upsert, 집계는 native query 로 처리한다. */
@Entity
@Table(name = "job_views")
public class JobViewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private String jobId;

    @Column(name = "viewer_key", nullable = false)
    private String viewerKey;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "viewed_on", nullable = false)
    private LocalDate viewedOn;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected JobViewEntity() {}

    public Long getId() { return id; }
    public String getJobId() { return jobId; }
    public String getViewerKey() { return viewerKey; }
    public UUID getUserId() { return userId; }
    public LocalDate getViewedOn() { return viewedOn; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
