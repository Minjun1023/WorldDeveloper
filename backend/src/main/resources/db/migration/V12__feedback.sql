-- 회원 피드백 인프라: 현재상태(saved/reactions) + 이벤트로그(recommendation_feedback).
CREATE TABLE saved_jobs (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_saved_jobs_user ON saved_jobs (user_id, created_at DESC);

CREATE TABLE job_reactions (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    reaction   TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

-- V1 의 recommendation_feedback(rating/breakdown/notes) 는 MVP 플레이스홀더로 미사용.
-- 이벤트 로그(action/rank/score) 모델로 교체한다(운영 데이터 없음 → 파괴적 변경 안전).
DROP TABLE IF EXISTS recommendation_feedback;
CREATE TABLE recommendation_feedback (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('impression','click','apply_click')),
    rank       INT,
    score      REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rec_feedback_user ON recommendation_feedback (user_id, created_at DESC);
