-- 공고 조회 로그 (분석 퍼널 + 인기 공고 토대).
-- 고유 열람자/일 기준 dedup: (job_id, viewer_key, viewed_on) 유니크 → 새로고침·봇 반복으로
-- 부풀려지지 않으면서 '일자별 활동'은 보존(재방문 D1/D7 측정 가능).
-- viewer_key = 로그인 'u:'+userId / 익명 'a:'+sha256(ip+ua). user_id 는 로그인 시에만 채움.
CREATE TABLE job_views (
    id          BIGSERIAL PRIMARY KEY,
    job_id      TEXT NOT NULL,
    viewer_key  TEXT NOT NULL,
    user_id     UUID,
    viewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, viewer_key, viewed_on)
);

CREATE INDEX idx_job_views_created_at ON job_views (created_at);
CREATE INDEX idx_job_views_job_id ON job_views (job_id);
CREATE INDEX idx_job_views_viewer ON job_views (viewer_key, viewed_on);
