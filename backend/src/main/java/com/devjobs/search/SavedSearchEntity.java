package com.devjobs.search;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "saved_searches")
public class SavedSearchEntity {

    @Id @Column(name = "id") private UUID id;
    @Column(name = "user_id") private UUID userId;
    @Column private String label;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private SavedSearchParams params;

    @Column(name = "created_at") private OffsetDateTime createdAt;
    @Column(name = "last_seen_at") private OffsetDateTime lastSeenAt;

    // 이메일 알림 (V34): 수신 여부 + 발송 워터마크 + 원클릭 해지 토큰.
    @Column private Boolean notify;
    @Column(name = "last_notified_at") private OffsetDateTime lastNotifiedAt;
    @Column(name = "unsubscribe_token") private UUID unsubscribeToken;

    protected SavedSearchEntity() {}

    public SavedSearchEntity(UUID userId, String label, SavedSearchParams params) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.label = label;
        this.params = params;
        this.createdAt = OffsetDateTime.now();
        this.lastSeenAt = OffsetDateTime.now();
        this.notify = true;
        this.lastNotifiedAt = OffsetDateTime.now();
        this.unsubscribeToken = UUID.randomUUID();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getLabel() { return label; }
    public SavedSearchParams getParams() { return params; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(OffsetDateTime v) { this.lastSeenAt = v; }
    public boolean isNotify() { return Boolean.TRUE.equals(notify); }
    public void setNotify(boolean v) { this.notify = v; }
    public OffsetDateTime getLastNotifiedAt() { return lastNotifiedAt; }
    public void setLastNotifiedAt(OffsetDateTime v) { this.lastNotifiedAt = v; }
    public UUID getUnsubscribeToken() { return unsubscribeToken; }
}
