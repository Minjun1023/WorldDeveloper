-- 저장 검색(인앱 알림용). params 는 JobService.search 파라미터를 그대로 담는 JSONB.
CREATE TABLE saved_searches (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label          TEXT NOT NULL,
    params         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_searches_user ON saved_searches (user_id, created_at DESC);
