package com.devjobs.tracker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "applications")
@IdClass(ApplicationEntity.Key.class)
public class ApplicationEntity {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Id
    @Column(name = "job_id")
    private String jobId;

    private String status;
    private String notes;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected ApplicationEntity() {}

    public ApplicationEntity(String userId, String jobId, String status, String notes) {
        this.userId = userId;
        this.jobId = jobId;
        this.status = status;
        this.notes = notes;
        this.updatedAt = OffsetDateTime.now();
    }

    public String getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public String getStatus() { return status; }
    public String getNotes() { return notes; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public void update(String status, String notes) {
        if (status != null) this.status = status;
        if (notes != null) this.notes = notes;
        this.updatedAt = OffsetDateTime.now();
    }

    /** 복합 PK (user_id, job_id) */
    public static class Key implements Serializable {
        private String userId;
        private String jobId;

        public Key() {}

        public Key(String userId, String jobId) {
            this.userId = userId;
            this.jobId = jobId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(userId, key.userId) && Objects.equals(jobId, key.jobId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, jobId);
        }
    }
}
