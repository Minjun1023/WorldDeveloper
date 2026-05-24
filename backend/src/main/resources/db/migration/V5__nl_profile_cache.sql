-- 자연어 프로필 파싱 결과 캐시 (text -> profile). 추천 결과는 캐싱하지 않음.
CREATE TABLE IF NOT EXISTS nl_profile_cache (
    input_hash   CHAR(64) PRIMARY KEY,        -- sha-256 hex of normalized text
    profile_json TEXT        NOT NULL,         -- 직렬화된 ParseResult
    source       VARCHAR(16) NOT NULL,         -- "rules" | "llm"
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
