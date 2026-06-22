-- 이메일 인증 토큰을 용도별로 구분(이메일 인증 vs 비밀번호 재설정).
-- 기존 행은 모두 이메일 인증(verify)으로 본다.
ALTER TABLE email_verification_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'verify';

-- token_hash 단독 UNIQUE → (user_id, token_hash, purpose) 조합 UNIQUE 로 변경.
-- 6자리 코드는 충돌 가능성이 있어 사용자·용도 단위로 유니크를 둔다. findByUserIdAndTokenHash
-- 조회와도 일치. (제약명은 V6 의 token_hash UNIQUE 자동 생성명.)
ALTER TABLE email_verification_tokens DROP CONSTRAINT email_verification_tokens_token_hash_key;
ALTER TABLE email_verification_tokens
    ADD CONSTRAINT uq_email_verif_user_hash_purpose UNIQUE (user_id, token_hash, purpose);

-- 회원탈퇴 시 조회 로그는 익명으로 보존(통계 깨지지 않게). user_id 만 NULL 로.
-- (job_views.user_id 는 그동안 FK 가 없었으므로 여기서 SET NULL FK 를 추가.)
ALTER TABLE job_views
    ADD CONSTRAINT fk_job_views_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
