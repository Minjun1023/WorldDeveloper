-- 공고 요약 캐시 (온디맨드 + 영구 캐싱). job_translations 와 동일 구조.
CREATE TABLE IF NOT EXISTS job_summaries (
    job_id       TEXT NOT NULL,
    lang         TEXT NOT NULL,
    summary_json TEXT NOT NULL,      -- {responsibilities,requirements,visa,compensation} JSON
    engine       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, lang),
    CONSTRAINT fk_job_summaries_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
