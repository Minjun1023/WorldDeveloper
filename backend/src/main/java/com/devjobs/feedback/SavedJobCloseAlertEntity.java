package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** 저장 공고 마감 알림 설정 — 유저당 1행 (V39). 통지 이력은 saved_jobs.closed_notified_at 이 담당. */
@Entity
@Table(name = "saved_job_close_alerts")
public class SavedJobCloseAlertEntity {

    @Id @Column(name = "user_id") private UUID userId;
    @Column private Boolean notify;
    @Column(name = "unsubscribe_token") private UUID unsubscribeToken;

    protected SavedJobCloseAlertEntity() {}

    public SavedJobCloseAlertEntity(UUID userId) {
        this.userId = userId;
        this.notify = true;
        this.unsubscribeToken = UUID.randomUUID();
    }

    public UUID getUserId() { return userId; }
    public boolean isNotify() { return Boolean.TRUE.equals(notify); }
    public void setNotify(boolean v) { this.notify = v; }
    public UUID getUnsubscribeToken() { return unsubscribeToken; }
}
