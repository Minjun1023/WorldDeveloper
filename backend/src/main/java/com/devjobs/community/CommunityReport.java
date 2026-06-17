package com.devjobs.community;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "community_reports")
public class CommunityReport {

    @Id private UUID id;
    @Column(name = "target_type") private String targetType;
    @Column(name = "target_id") private UUID targetId;
    @Column(name = "reporter_id") private UUID reporterId;
    private String reason;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected CommunityReport() {}

    public CommunityReport(String targetType, UUID targetId, UUID reporterId, String reason) {
        this.id = UUID.randomUUID();
        this.targetType = targetType;
        this.targetId = targetId;
        this.reporterId = reporterId;
        this.reason = reason;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
}
