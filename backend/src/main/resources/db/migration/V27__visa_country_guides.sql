-- 국가 단위 비자 가이드 사전합성 캐시. 시드(ai/app/visa_guides.py)가 채운다.
CREATE TABLE visa_country_guides (
    country       TEXT        PRIMARY KEY,        -- ISO2 소문자: us/gb/de/nl/ca
    guide_text    TEXT        NOT NULL,
    sources       TEXT        NOT NULL,           -- JSON 배열 문자열: [{"title","url","retrieved_at"}]
    disclaimer    TEXT        NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 국가 단위는 의미검색 불필요 → 임베딩/ivfflat 제거(시드가 가벼워짐).
DROP INDEX IF EXISTS idx_visa_guides_embedding;
ALTER TABLE visa_guides DROP COLUMN IF EXISTS embedding;
