-- 본문 정규식 추출 메타 (analyzers/job_meta.py — LLM 미사용):
--   relocation_support: true=이주 지원 명시, false=명시 거부, null=무언급(대다수)
--   language_requirement: 'german' 등 현지어 요구 | 'english_only' | null
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS relocation_support BOOLEAN,
    ADD COLUMN IF NOT EXISTS language_requirement TEXT;

-- "이주 지원 공고" 필터용 부분 인덱스(true 인 행만 — 3% 안팎이라 작다).
CREATE INDEX IF NOT EXISTS idx_jobs_relocation ON jobs (relocation_support) WHERE relocation_support = true;
