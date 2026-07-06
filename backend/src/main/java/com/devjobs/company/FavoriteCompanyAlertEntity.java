package com.devjobs.company;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/** 관심 기업 새 공고 다이제스트 상태 — 유저당 1행 (V38). SavedSearchEntity 알림 필드와 동일 패턴. */
@Entity
@Table(name = "favorite_company_alerts")
public class FavoriteCompanyAlertEntity {

    @Id @Column(name = "user_id") private UUID userId;
    @Column private Boolean notify;
    @Column(name = "last_notified_at") private OffsetDateTime lastNotifiedAt;
    @Column(name = "unsubscribe_token") private UUID unsubscribeToken;

    protected FavoriteCompanyAlertEntity() {}

    public FavoriteCompanyAlertEntity(UUID userId) {
        this.userId = userId;
        this.notify = true;
        this.lastNotifiedAt = OffsetDateTime.now();
        this.unsubscribeToken = UUID.randomUUID();
    }

    public UUID getUserId() { return userId; }
    public boolean isNotify() { return Boolean.TRUE.equals(notify); }
    public void setNotify(boolean v) { this.notify = v; }
    public OffsetDateTime getLastNotifiedAt() { return lastNotifiedAt; }
    public void setLastNotifiedAt(OffsetDateTime v) { this.lastNotifiedAt = v; }
    public UUID getUnsubscribeToken() { return unsubscribeToken; }
}
