-- dev-jobs-site V1 초기 스키마
-- DESIGN.md 섹션 4 의 5개 테이블 + pgvector

CREATE EXTENSION IF NOT EXISTS vector;

-- 회사
CREATE TABLE companies (
    slug                TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    ats                 TEXT,
    ats_token           TEXT,
    tags                TEXT[],
    website_url         TEXT,
    blog_rss_url        TEXT,
    hn_intel            JSONB,
    last_intel_refresh  TIMESTAMPTZ
);

-- 공고
CREATE TABLE jobs (
    id                TEXT PRIMARY KEY,
    source            TEXT NOT NULL,
    title             TEXT NOT NULL,
    company_slug      TEXT NOT NULL REFERENCES companies(slug),
    location          TEXT,
    is_remote         BOOLEAN,
    employment_type   TEXT,
    description       TEXT,
    description_text  TEXT,
    apply_url         TEXT,
    posted_at         TIMESTAMPTZ,
    tags              TEXT[],
    salary_min_usd    INTEGER,
    salary_max_usd    INTEGER,
    visa_status       TEXT,
    visa_evidence     JSONB,
    embedding         VECTOR(384),
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_jobs_embedding ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_jobs_visa_loc_posted ON jobs (visa_status, location, posted_at DESC);
CREATE INDEX idx_jobs_tags ON jobs USING GIN (tags);
CREATE INDEX idx_jobs_active ON jobs (is_active) WHERE is_active = TRUE;

-- 사용자
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oauth_provider  TEXT NOT NULL,
    oauth_sub       TEXT NOT NULL,
    email           TEXT,
    display_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (oauth_provider, oauth_sub)
);

-- 지원 추적
CREATE TABLE applications (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      TEXT NOT NULL REFERENCES jobs(id),
    status      TEXT NOT NULL,
    notes       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

CREATE TABLE application_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    job_id      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_events_user_job ON application_events (user_id, job_id, created_at DESC);

-- 추천 피드백
CREATE TABLE recommendation_feedback (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    job_id      TEXT NOT NULL,
    rating      TEXT NOT NULL CHECK (rating IN ('positive','negative')),
    breakdown   JSONB,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_user ON recommendation_feedback (user_id, created_at DESC);
