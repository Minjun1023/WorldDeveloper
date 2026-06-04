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
@Table(name = "job_reactions")
@IdClass(JobReactionEntity.Key.class)
public class JobReactionEntity {
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
    @Column private String reaction;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    protected JobReactionEntity() {}
    public JobReactionEntity(UUID userId, String jobId, String reaction) {
        this.userId = userId; this.jobId = jobId; this.reaction = reaction; this.updatedAt = OffsetDateTime.now();
    }
    public UUID getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public String getReaction() { return reaction; }
    public void setReaction(String reaction) { this.reaction = reaction; this.updatedAt = OffsetDateTime.now(); }
}
