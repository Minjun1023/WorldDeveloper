-- 커뮤니티(해외취업 라운지) Phase 1: 글 / 댓글 / 반응 / 신고.
-- 개방형(누구나 작성) + 결합형(회사·공고·국가 연결) + 정직성(출처 표기). 검증 배지는 Phase 2.

CREATE TABLE community_posts (
    id                  UUID PRIMARY KEY,
    author_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category            TEXT NOT NULL,                       -- visa | interview | salary | settle | company | qna
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    anonymous           BOOLEAN NOT NULL DEFAULT false,
    source_type         TEXT NOT NULL DEFAULT 'experience',  -- experience(직접경험) | secondhand(전해들음) | question
    source_url          TEXT,
    linked_company_slug TEXT,
    linked_job_id       TEXT,
    linked_country      TEXT,
    status              TEXT NOT NULL DEFAULT 'published',    -- published | flagged | removed
    comment_count       INTEGER NOT NULL DEFAULT 0,
    score               INTEGER NOT NULL DEFAULT 0,           -- 반응 수 캐시
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_posts_recent ON community_posts (status, created_at DESC);
CREATE INDEX idx_community_posts_category ON community_posts (category, status, created_at DESC);
CREATE INDEX idx_community_posts_company ON community_posts (linked_company_slug) WHERE linked_company_slug IS NOT NULL;
CREATE INDEX idx_community_posts_country ON community_posts (linked_country) WHERE linked_country IS NOT NULL;

CREATE TABLE community_comments (
    id          UUID PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    anonymous   BOOLEAN NOT NULL DEFAULT false,
    status      TEXT NOT NULL DEFAULT 'published',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_comments_post ON community_comments (post_id, created_at);

-- 반응(추천) — Phase 1 은 글 단위만. 사용자당 1회(복합 PK).
CREATE TABLE community_reactions (
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE community_reports (
    id           UUID PRIMARY KEY,
    target_type  TEXT NOT NULL,   -- post | comment
    target_id    UUID NOT NULL,
    reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_reports_target ON community_reports (target_type, target_id);
