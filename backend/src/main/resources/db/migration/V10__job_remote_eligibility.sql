-- 원격 공고의 한국 거주자 지원 가능 권역.
-- worldwide / apac_ok / region_restricted / unclear / NULL(원격 아님)
ALTER TABLE jobs ADD COLUMN remote_eligibility TEXT;
ALTER TABLE jobs ADD COLUMN remote_evidence    JSONB;

-- viable 필터 + remote 티어 정렬용 (visa 인덱스 idx_jobs_visa_loc_posted 미러)
CREATE INDEX idx_jobs_remote_elig_posted ON jobs (remote_eligibility, posted_at DESC);
