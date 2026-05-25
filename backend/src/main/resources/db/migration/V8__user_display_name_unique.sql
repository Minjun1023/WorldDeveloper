-- 표시이름(display_name) 대소문자 무시 유니크. lower(NULL)=NULL 이라 OAuth 계정(NULL) 다중 허용.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower ON users (lower(display_name));
