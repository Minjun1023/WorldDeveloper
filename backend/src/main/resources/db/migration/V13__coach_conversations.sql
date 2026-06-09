-- 이력서 코치 대화 저장(공고당 1대화). 메시지만 JSONB로 저장 — 이력서 원문은 저장하지 않는다.
-- 90일 만료는 애플리케이션(조회 필터 + 쓰기 시 기회적 정리)에서 처리.
CREATE TABLE coach_conversations (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id         TEXT NOT NULL,
    messages       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_coach_conv_expiry ON coach_conversations (last_active_at);
