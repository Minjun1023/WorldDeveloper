-- 표시이름(display_name) 대소문자 무시 유니크. lower(NULL)=NULL 이라 OAuth 계정(NULL) 다중 허용.
-- 인덱스 적용 전 기존 대소문자 무시 중복을 정리한다(가장 먼저 가입한 행 유지, 나머지는 id 접미사로 구분).
-- 비어있지 않은 DB에서도 마이그레이션이 앱 부팅을 막지 않도록 자가치유.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(display_name) ORDER BY created_at, id) AS rn
    FROM users
    WHERE display_name IS NOT NULL
)
UPDATE users u
SET display_name = u.display_name || '_' || u.id::text
FROM ranked r
WHERE u.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower ON users (lower(display_name));
