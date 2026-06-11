-- 원본 통화 연봉 표시값(USD 환산 salary_min_usd/max_usd 와 별개, 추천 점수/정렬은 그대로 USD 사용).
ALTER TABLE jobs ADD COLUMN salary_min      BIGINT,
                 ADD COLUMN salary_max      BIGINT,
                 ADD COLUMN salary_currency VARCHAR(8),
                 ADD COLUMN salary_period   VARCHAR(8);
