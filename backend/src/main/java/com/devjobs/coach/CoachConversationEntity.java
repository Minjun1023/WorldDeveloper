package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

// 공고당 대화 1개. 복합키(user_id, job_id) — saved_jobs 패턴. 메시지는 JSONB(@JdbcTypeCode JSON).
@Entity
@Table(name = "coach_conversations")
@IdClass(CoachConversationEntity.Key.class)
public class CoachConversationEntity {

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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<ChatMessage> messages = new ArrayList<>();

    @Column(name = "created_at") private OffsetDateTime createdAt;
    @Column(name = "last_active_at") private OffsetDateTime lastActiveAt;

    protected CoachConversationEntity() {}

    public CoachConversationEntity(UUID userId, String jobId) {
        this.userId = userId;
        this.jobId = jobId;
        this.createdAt = OffsetDateTime.now();
        this.lastActiveAt = OffsetDateTime.now();
    }

    public UUID getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public List<ChatMessage> getMessages() { return messages == null ? List.of() : messages; }
    public void setMessages(List<ChatMessage> v) { this.messages = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(OffsetDateTime v) { this.lastActiveAt = v; }
}
