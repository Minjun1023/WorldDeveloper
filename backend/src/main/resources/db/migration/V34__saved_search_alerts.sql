-- 저장 검색 이메일 알림: 발송 워터마크 + 수신 여부 + 원클릭 해지 토큰.
-- last_notified_at 은 '이 시점 이후 게시된 공고만 다음 메일에 포함'하는 중복 발송 방지 기준.
ALTER TABLE saved_searches
    ADD COLUMN IF NOT EXISTS notify BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_unsub_token
    ON saved_searches (unsubscribe_token);
