-- 공고 번역 캐시 (온디맨드 + 영구 캐싱). 본 공고만, 언어별로 한 번만 번역.
CREATE TABLE IF NOT EXISTS job_translations (
    job_id      TEXT NOT NULL,
    lang        TEXT NOT NULL,
    title       TEXT,
    description TEXT,
    engine      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, lang),
    CONSTRAINT fk_job_translations_job
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
