package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "saved_jobs")
@IdClass(SavedJobEntity.Key.class)
public class SavedJobEntity {
    public static class Key implements Serializable {
        public UUID userId;
        public String jobId;
        public Key() {}
        public Key(UUID userId, String jobId) { this.userId = userId; this.jobId = jobId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return userId.equals(k.userId) && jobId.equals(k.jobId);
        }
        @Override public int hashCode() { return userId.hashCode() * 31 + jobId.hashCode(); }
    }

    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "job_id") private String jobId;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected SavedJobEntity() {}
    public SavedJobEntity(UUID userId, String jobId) {
        this.userId = userId; this.jobId = jobId; this.createdAt = OffsetDateTime.now();
    }
    public UUID getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
