-- 커뮤니티(라운지) 기능 제거(2026-07): 사용하지 않기로 결정.
-- 백엔드 컨트롤러·서비스·엔티티, 프론트 페이지·컴포넌트·BFF 라우트를 모두 걷어냈다.
-- 6개 테이블 제거(자식이 community_posts 를 FK 참조 → CASCADE).
-- (V20/V22/V29 가 생성·변경 — Flyway 이력 보존 위해 그대로 두고 여기서 DROP.)
DROP TABLE IF EXISTS
    community_comments,
    community_reactions,
    community_reports,
    community_post_tags,
    community_post_views,
    community_posts
    CASCADE;
