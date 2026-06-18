-- 커뮤니티 Phase 3: 태그 + 조회수(고유 열람자 기준) + facet 집계 지원.
-- 태그는 자유 입력(정규화: # 제거·트림·소문자 중복제거·최대 5개), 조인 테이블로 보관.

CREATE TABLE community_post_tags (
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    tag     TEXT NOT NULL,
    PRIMARY KEY (post_id, tag)
);
CREATE INDEX idx_community_post_tags_tag ON community_post_tags (tag);

-- 조회수 캐시 컬럼. 실제 카운트는 고유 열람자 1회 기준(아래 dedup 테이블).
ALTER TABLE community_posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- 고유 열람자(로그인=userId, 익명=IP 해시)당 1회만 집계 → 새로고침/봇 반복으로 부풀려지지 않음.
CREATE TABLE community_post_views (
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    viewer_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, viewer_key)
);
