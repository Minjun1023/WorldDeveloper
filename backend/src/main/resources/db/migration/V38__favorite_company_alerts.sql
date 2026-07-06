-- 관심 기업 새 공고 이메일 다이제스트: 유저당 1행 (전역 on/off + 발송 워터마크 + 원클릭 해지 토큰).
-- saved_searches 알림(V34)과 동일 패턴 — last_notified_at 이후 게시 공고만 다음 메일에 포함(멱등).
CREATE TABLE favorite_company_alerts (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify            BOOLEAN NOT NULL DEFAULT true,
    last_notified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX idx_fav_company_alerts_unsub_token
    ON favorite_company_alerts (unsubscribe_token);

-- 이미 관심 기업을 등록한 유저 백필(자동 켬). 워터마크는 지금부터 — 과거 공고 스팸 방지.
INSERT INTO favorite_company_alerts (user_id)
SELECT DISTINCT user_id FROM favorite_companies
ON CONFLICT (user_id) DO NOTHING;
