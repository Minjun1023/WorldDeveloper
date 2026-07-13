-- 계정별 AI 크레딧(일일 차감) — 유료 AI 경로(이력서 코치 등)의 사용자당 일일 상한.
-- kind 별 1행(PK user_id+kind), day 가 오늘(KST)이 아니면 차감 시 리셋(별도 배치 불필요).
-- 날짜 경계는 KST(운영 cron·ETL 과 동일 기준) — 차감 쿼리에서 계산한다.
-- FK 없음(의도): 운영 카운터라 users 와 느슨하게 둔다(레이트리밋 키와 동급 성격).
CREATE TABLE user_ai_credits (
    user_id UUID NOT NULL,
    kind    TEXT NOT NULL,              -- 'coach' (향후 summary/note 등 확장)
    day     DATE NOT NULL,
    used    INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, kind)
);
