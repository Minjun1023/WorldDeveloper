# backend/ — Spring Boot

Java 17 + Spring Boot 3.4 + JPA + Flyway + JWT.

## 실행

```bash
# 1. Postgres 먼저
cd .. && docker compose up -d postgres

# 2. 로컬 실행
cd backend && ./gradlew bootRun
# 또는 wrapper 없으면:
gradle bootRun

# 3. 헬스 체크
curl http://localhost:8080/api/v1/health
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5433/devjobs` | JDBC URL (docker host 포트 5433) |
| `DATABASE_USER` | `devjobs` | DB 사용자 |
| `DATABASE_PASSWORD` | `devjobs_local` | DB 비밀번호 |
| `PORT` | `8080` | HTTP 포트 |
| `JWT_SECRET` | (미설정) | NextAuth NEXTAUTH_SECRET 와 동일 값 |

## 구조

```
src/main/java/com/devjobs/
├── Application.java            엔트리포인트
├── config/
│   └── SecurityConfig.java     인증 가드 (MVP: /me/** 만 보호)
├── health/
│   └── HealthController.java   /api/v1/health
├── scout/        (W3 추가 예정 — 검색·필터)
├── analyst/      (W4 — 분석·인텔)
├── strategist/   (W6 — 추천·점수화)
├── tracker/      (W7 — 지원·피드백)
└── recovery/     (W1.1 — 회복·이력서 최적화)
```

DESIGN.md 섹션 13 의 Discipline Agents 매핑 그대로.

## Flyway

마이그레이션 위치: `src/main/resources/db/migration/V*.sql`. 부팅 시 자동 적용.

## 테스트

```bash
./gradlew test
```

H2 in-memory DB 사용 (Flyway 비활성). 통합 테스트는 Testcontainers 도입 시 별도 추가.
