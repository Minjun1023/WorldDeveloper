-- 커뮤니티 닉네임(handle). 미설정 시 자동 닉네임(userId 해시) 사용.
-- 대소문자 무시 유니크(임포스터 방지). NULL 은 제약 대상 아님(자동 닉네임 사용자 다수 허용).
ALTER TABLE user_profiles ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX uq_user_profiles_handle ON user_profiles (lower(handle)) WHERE handle IS NOT NULL;
