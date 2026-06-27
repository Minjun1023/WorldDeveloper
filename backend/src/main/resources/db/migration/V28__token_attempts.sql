-- 이메일 인증/비밀번호 재설정 코드의 시도 횟수 추적(브루트포스 방어).
-- 6자리 코드(10^6) + 10분 유효라, 시도 잠금 없이는 분산 IP 로 추측 가능했다.
ALTER TABLE email_verification_tokens
    ADD COLUMN attempts INT NOT NULL DEFAULT 0;
