-- 공고 소재 국가(ISO 3166-1 alpha-2 소문자, 예: us/gb/il/in). location 자유텍스트에서
-- ingest 시 dev_jobs_core.geo.detect_country 로 파생. 지역 필터/집계를 하드코딩 목록이 아니라
-- 데이터에서 GROUP BY 로 얻기 위함(불명확하면 NULL). 원격은 country 와 별개(is_remote).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country TEXT;

-- 지역 드롭다운 GROUP BY country + 국가별 필터용.
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs (country) WHERE is_active = true;
