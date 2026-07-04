-- 저장 검색 알림(countSearchSince)의 first_seen_at > :since 술어용.
-- 활성 공고만 대상이라 부분 인덱스로 작게 유지.
CREATE INDEX IF NOT EXISTS idx_jobs_first_seen_active
    ON jobs (first_seen_at DESC) WHERE is_active = true;
