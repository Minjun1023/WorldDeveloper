-- 공고 본문/제목에서 추출한 경력(요구 연차)·시니어리티(직급)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_years int;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS seniority text;
