-- 회원 프로필 (user 1:1). 추천 스코러 입력 항목. 비자필요는 저장 안 함(항상 true 고정).
CREATE TABLE user_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills              TEXT[]      NOT NULL DEFAULT '{}',
    seniority           TEXT,
    years_experience    INT,
    preferred_locations TEXT[]      NOT NULL DEFAULT '{}',
    remote_preference   TEXT,
    desired_salary_usd  INT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
