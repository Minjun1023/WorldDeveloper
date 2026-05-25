-- 통합 계정 모델: users 재편 + 식별자/인증토큰/핸드오프코드 테이블
-- (운영 데이터 없음 → 파괴적 변경 안전)

ALTER TABLE users DROP COLUMN oauth_provider;
ALTER TABLE users DROP COLUMN oauth_sub;

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- 이메일은 통합 계정의 자연키 (앱에서 소문자 정규화 저장)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- OAuth 식별자 (provider, sub) -> user 연결
CREATE TABLE user_identities (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    provider_sub  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_sub)
);
CREATE INDEX idx_user_identities_user ON user_identities (user_id);

-- 이메일 인증 토큰 (해시 저장, 단회, 만료)
CREATE TABLE email_verification_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_verif_user ON email_verification_tokens (user_id);

-- OAuth 콜백 -> web 핸드오프용 일회용 코드 (해시 저장, 60초 TTL, 단회)
CREATE TABLE oauth_handoff_codes (
    id          BIGSERIAL PRIMARY KEY,
    code_hash   TEXT NOT NULL UNIQUE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
