-- MVP: user_id 를 JWT sub(문자열) 로 직접 사용. users 테이블/FK 는 OAuth 정식 도입 시 복원.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_user_id_fkey;
ALTER TABLE applications ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE application_events ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE recommendation_feedback ALTER COLUMN user_id TYPE TEXT;
