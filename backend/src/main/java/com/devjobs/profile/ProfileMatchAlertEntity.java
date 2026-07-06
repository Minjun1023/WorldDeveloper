package com.devjobs.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 프로필 5축 매칭 신규 공고 알림 상태 — 유저당 1행 (V40).
 * 프로필 저장은 '구독' 의사가 아니므로 기본 꺼짐 — 추천 페이지 토글로 명시적 옵트인.
 */
@Entity
@Table(name = "profile_match_alerts")
public class ProfileMatchAlertEntity {

    @Id @Column(name = "user_id") private UUID userId;
    @Column private Boolean notify;
    @Column(name = "last_notified_at") private OffsetDateTime lastNotifiedAt;
    @Column(name = "unsubscribe_token") private UUID unsubscribeToken;

    protected ProfileMatchAlertEntity() {}

    public ProfileMatchAlertEntity(UUID userId, boolean notify) {
        this.userId = userId;
        this.notify = notify;
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
