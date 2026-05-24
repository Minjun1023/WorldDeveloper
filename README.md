# WorldDeveloper

한국 개발자가 해외(특히 EU) 진출용 채용 공고를 찾는 사이트.

전체 설계는 [`DESIGN.md`](./DESIGN.md) 참고.

## Monorepo 구조

```
WorldDeveloper/
├── web/            Next.js 14 (App Router)
├── backend/        Spring Boot (Java 17+)
├── ai/             FastAPI (Python 3.12+, 임베딩 + ETL)
├── db/             Flyway SQL 마이그레이션
├── dev-jobs-mcp/   채용 공고 MCP 서버 (Python, 독립 패키지 — .venv 는 미커밋)
└── docker-compose.yml   로컬 Postgres+pgvector
```

## 로컬 개발

```bash
# 1. Postgres 띄우기
docker compose up -d postgres

# 2. Backend (Spring)
cd backend && ./gradlew bootRun
#   → http://localhost:8080/api/v1/health

# 3. AI (FastAPI)
cd ai && uv sync && uv run uvicorn app.main:app --reload --port 8001
#   → http://localhost:8001/internal/health

# 4. Web (Next.js)
cd web && npm install && npm run dev
#   → http://localhost:3000
```

## 환경 요구사항

- Node 20+ / npm
- Python 3.12+ / uv
- JDK 17+
- Docker + Docker Compose

## 다음 단계

DESIGN.md 의 [섹션 14 (다음 액션)](./DESIGN.md) 참고.
