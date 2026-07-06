-- 저장(관심) 공고 마감 알림: 유저당 1행 설정 + 저장 공고별 통지 플래그.
-- 마감 시각이 따로 기록되지 않으므로 워터마크 대신 행 단위 플래그(closed_notified_at)로 1회 통지를 보장.
CREATE TABLE saved_job_close_alerts (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify            BOOLEAN NOT NULL DEFAULT true,
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX idx_saved_job_close_alerts_unsub_token
    ON saved_job_close_alerts (unsubscribe_token);

ALTER TABLE saved_jobs ADD COLUMN closed_notified_at TIMESTAMPTZ;

-- 이미 저장 공고가 있는 유저 백필(자동 켬).
INSERT INTO saved_job_close_alerts (user_id)
SELECT DISTINCT user_id FROM saved_jobs
ON CONFLICT (user_id) DO NOTHING;

-- 배포 시점에 이미 마감돼 있던 저장 공고는 통지 완료로 마킹 — 첫 배치가 묵은 마감을 쏟아내는 스팸 방지.
UPDATE saved_jobs sj
SET closed_notified_at = now()
FROM jobs j
WHERE j.id = sj.job_id
  AND (j.is_active = false OR (j.closes_at IS NOT NULL AND j.closes_at < now()));
