-- 비자 가이드 RAG 코퍼스. 국가별 섹션 청크 + pgvector 임베딩(384d).
-- 시드는 ai/scripts/seed_visa_guides.py 가 docs/visa-guides/*.md 에서 수행.
CREATE TABLE visa_guides (
    id            BIGSERIAL PRIMARY KEY,
    country       TEXT        NOT NULL,            -- ISO2 소문자: us/gb/de/nl/ca
    section       TEXT        NOT NULL,            -- visa_types/sponsorship/salary/process/korea_notes
    title         TEXT        NOT NULL,
    content       TEXT        NOT NULL,
    source_url    TEXT        NOT NULL,
    retrieved_at  DATE        NOT NULL,
    embedding     VECTOR(384) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country, section)
);

CREATE INDEX idx_visa_guides_country ON visa_guides (country);
CREATE INDEX idx_visa_guides_embedding ON visa_guides USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
