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

    protected SavedSearchEntity() {}

    public SavedSearchEntity(UUID userId, String label, SavedSearchParams params) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.label = label;
        this.params = params;
        this.createdAt = OffsetDateTime.now();
        this.lastSeenAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getLabel() { return label; }
    public SavedSearchParams getParams() { return params; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(OffsetDateTime v) { this.lastSeenAt = v; }
}
