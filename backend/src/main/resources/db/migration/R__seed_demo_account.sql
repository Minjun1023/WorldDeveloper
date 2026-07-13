-- 리뷰어용 데모 로그인 계정 + 프로필 시드 — 회원가입 없이 5축 매칭·AI 코치를 바로 체험.
-- Repeatable 마이그레이션(R__): 버전 순서(V##)와 무관하게 항상 마지막에 적용되고, 내용이
-- 바뀔 때만 재실행된다. 그래서 열려있는 다른 PR 의 V## 과 번호 충돌/순서 문제를 일으키지 않는다.
--
-- 로그인:  demo@devpass.io  /  DevPass2026
--   password_hash 는 BCrypt($2a$10) — 백엔드 BCryptPasswordEncoder 와 호환.
--   비밀번호가 바뀌면 DemoAccountSeedTest 가 이 파일의 해시와 문서 비밀번호 불일치를 잡는다.
-- email_verified_at 세팅 → 이메일 인증 단계 없이 즉시 로그인 가능.
-- ON CONFLICT DO NOTHING → 재실행/운영에서 비밀번호를 바꿔둔 경우에도 기존 행을 보존.

INSERT INTO users (id, email, display_name, password_hash, email_verified_at, created_at)
VALUES (
    gen_random_uuid(),
    'demo@devpass.io',
    'DevPass 데모',
    '$2a$10$8kF1Tgj1/tudpW1eJKb4aelv5HETCy5ai68rYS7pJM86i017i8Oqq',
    now(),
    now()
)
ON CONFLICT (email) DO NOTHING;

-- 데모 프로필(추천 5축 입력) — user_id 는 이메일로 조회해 연결(고정 UUID 불필요, 재실행 안전).
INSERT INTO user_profiles (
    user_id, skills, seniority, years_experience,
    preferred_locations, remote_preference, desired_salary_usd, bio, updated_at)
SELECT
    id,
    ARRAY['React', 'TypeScript', 'Node.js', 'Java', 'Spring Boot', 'PostgreSQL', 'AWS'],
    'senior', 6,
    ARRAY['Netherlands', 'Germany', 'United Kingdom'],
    'remote', 120000,
    '6년차 풀스택 엔지니어. React/TypeScript 프론트엔드와 Java/Spring Boot 백엔드를 두루 다루며, 비자 스폰서십이 가능한 유럽 테크 기업으로의 이직을 준비 중입니다.',
    now()
FROM users
WHERE email = 'demo@devpass.io'
ON CONFLICT (user_id) DO NOTHING;
