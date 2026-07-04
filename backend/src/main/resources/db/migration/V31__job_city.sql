-- 공고 소재 도시(정규 slug, 예: san-francisco/bengaluru/tokyo). location 자유텍스트에서
-- ingest 시 dev_jobs_core.geo.detect_city 로 파생. 도시 상세 패널을 하드코딩 목록이 아니라
-- 데이터에서 GROUP BY 로 얻기 위함(불명확하면 NULL).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city TEXT;

-- 국가 안에서 도시별 GROUP BY / 도시 필터용.
CREATE INDEX IF NOT EXISTS idx_jobs_country_city ON jobs (country, city) WHERE is_active = true;
