-- 1인이 같은 대상을 여러 번 신고해 자동숨김 임계치(3)를 혼자 채우는 남용 방지.
-- 경쟁으로 생긴 중복 행을 먼저 제거한 뒤 (target_id, reporter_id) UNIQUE 제약 추가.
DELETE FROM community_reports a
    USING community_reports b
    WHERE a.ctid < b.ctid
      AND a.target_id = b.target_id
      AND a.reporter_id = b.reporter_id;

ALTER TABLE community_reports
    ADD CONSTRAINT uq_community_reports_target_reporter UNIQUE (target_id, reporter_id);
