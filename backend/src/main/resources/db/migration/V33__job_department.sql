-- 부서/팀 정보 (greenhouse departments, lever categories.team, smartrecruiters function).
-- 공고 상세 표시용 — 검색 조건이 아니므로 인덱스 없음.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department TEXT;
