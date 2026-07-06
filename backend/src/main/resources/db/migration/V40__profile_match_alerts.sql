-- 프로필 5축 매칭 신규 공고 알림: 유저당 1행 (워터마크 배치 — favorite_company_alerts 와 동일 패턴).
-- 프로필 저장은 '구독' 의사가 아니므로 기본 꺼짐(notify=false) — 추천 페이지 토글로 명시적 옵트인.
CREATE TABLE profile_match_alerts (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify            BOOLEAN NOT NULL DEFAULT false,
    last_notified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX idx_profile_match_alerts_unsub_token
    ON profile_match_alerts (unsubscribe_token);
