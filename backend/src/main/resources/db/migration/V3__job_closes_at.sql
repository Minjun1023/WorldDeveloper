-- 공고 마감일 (소스가 제공할 때만 채워짐; 대부분 NULL).
-- NULL 인 공고는 ETL 의 posted_at 기반 만료 정책으로 비활성화된다.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;

-- 만료 비활성화 스윕용 — 활성 공고의 closes_at 조회
CREATE INDEX IF NOT EXISTS idx_jobs_closes_at ON jobs (closes_at) WHERE is_active = TRUE;
