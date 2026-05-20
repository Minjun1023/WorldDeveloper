# db/ — Postgres 스키마

Flyway 마이그레이션. Spring Boot 가 자동 실행 (`backend/build.gradle.kts` 의 `flyway-core` 의존성).

## 파일 명명 규칙

```
V{버전}__{설명}.sql
```

예: `V1__init_schema.sql`, `V2__add_company_size.sql`

버전은 단조증가. 한 번 적용한 파일은 수정 금지 (Flyway checksum 검증).

## 로컬 테스트

```bash
docker compose up -d postgres
cd ../backend && ./gradlew flywayMigrate
```

또는 Spring Boot 실행 시 자동 적용.
