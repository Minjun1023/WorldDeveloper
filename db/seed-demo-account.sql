-- 데모/리뷰어용 계정 시드 (포트폴리오 데모용).
-- 가입 + 이메일 인증 완료 상태로 바로 로그인 가능 + 추천이 풍부하게 나오도록 프로필 포함.
-- 재실행해도 안전(idempotent).
--
--   로그인:  demo@worlddeveloper.dev  /  WorldDemo2026
--
-- 실행 (운영):
--   docker compose -f deploy/docker-compose.prod.yml exec -T postgres \
--       psql -U devjobs -d devjobs < db/seed-demo-account.sql
-- 실행 (로컬):
--   docker compose exec -T postgres psql -U devjobs -d devjobs < db/seed-demo-account.sql

-- 1) 계정 — password_hash 는 BCrypt('WorldDemo2026'), email_verified_at 설정으로 인증 우회
INSERT INTO users (email, display_name, password_hash, email_verified_at)
VALUES (
    'demo@worlddeveloper.dev',
    '데모 리뷰어',
    '$2b$10$7Kxm.zM6TWcVc5SlHDqkie58bOkl8Ehx2GLGqpmMDqTFr.GYMC/0O',  -- WorldDemo2026
    now()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash     = EXCLUDED.password_hash,
    email_verified_at = now();

-- 2) 프로필 — 5축 매칭 입력(추천 화면이 의미 있게 보이도록 시니어 백엔드/유럽 선호로 시드)
INSERT INTO user_profiles (
    user_id, skills, seniority, years_experience,
    preferred_locations, remote_preference, desired_salary_usd, bio
)
SELECT
    u.id,
    ARRAY['python', 'django', 'aws', 'postgresql', 'docker', 'kubernetes'],
    'senior',
    6,
    ARRAY['Berlin', 'Amsterdam', 'Remote'],
    'hybrid_ok',
    95000,
    'ML 인프라에 관심 많은 백엔드 엔지니어. 유럽 비자 스폰서 포지션을 찾고 있습니다.'
FROM users u
WHERE u.email = 'demo@worlddeveloper.dev'
ON CONFLICT (user_id) DO UPDATE SET
    skills              = EXCLUDED.skills,
    seniority           = EXCLUDED.seniority,
    years_experience    = EXCLUDED.years_experience,
    preferred_locations = EXCLUDED.preferred_locations,
    remote_preference   = EXCLUDED.remote_preference,
    desired_salary_usd  = EXCLUDED.desired_salary_usd,
    bio                 = EXCLUDED.bio;
