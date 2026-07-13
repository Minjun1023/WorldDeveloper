-- NL 자연어 추천 기능 제거(2026-07): 파싱 프로필 캐시 테이블 폐기.
-- (비로그인 맛보기 추천을 제품에서 내리기로 결정 — 검색·로그인 매칭과 역할 중복)
DROP TABLE IF EXISTS nl_profile_cache;
