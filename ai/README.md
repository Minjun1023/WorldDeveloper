# ai/ — FastAPI 임베딩 서비스 + ETL

Python 3.12+ / FastAPI / APScheduler. Spring 백엔드의 **내부 호출 전용**.

## 책임 범위 (얇음)

- `POST /internal/embed` — text → vector(384)
- `POST /internal/etl/trigger` — 수동 ETL (개발)
- 백그라운드: APScheduler in-process cron (수집 + 비자 분류 + 임베딩 + Postgres UPSERT)

추천 점수 계산·정렬은 **Spring** 책임 (DESIGN.md 섹션 3 참고).

## 실행

```bash
# 1. uv 동기화 (Python 의존성)
cd ai && uv sync

# 2. 임베딩 백엔드 포함 (선택, ~수백 MB)
uv sync --extra embeddings

# 3. dev 서버
uv run uvicorn app.main:app --reload --port 8001

# 4. 헬스 체크
curl http://localhost:8001/internal/health
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8001` | HTTP 포트 |
| `DATABASE_URL` | `postgresql://devjobs:devjobs_local@localhost:5433/devjobs` | Postgres (docker host 포트 5433) |
| `EMBEDDING_MODEL` | `paraphrase-multilingual-MiniLM-L12-v2` | 한/영 매칭 |
| `EMBEDDING_DIM` | `384` | 모델 dim |
| `ETL_ENABLED` | `false` | APScheduler cron 활성 |
| `ETL_INTERVAL_MINUTES` | `60` | cron 주기 |
| `INTERNAL_AUTH_TOKEN` | `dev-local-token` | Spring → FastAPI Basic Auth (TODO) |
| `OPENAI_API_KEY` | (빈값) | 요약·프로필 파싱(미설정 시 해당 기능 비활성) |
| `DEEPL_API_KEY` | (빈값) | 번역(DeepL). Free 플랜 키는 `:fx` 로 끝남(api-free 자동 선택). 미설정 시 번역 503 |

## 구조

```
ai/
├── pyproject.toml
├── app/
│   ├── main.py             FastAPI app + lifespan
│   ├── config.py           pydantic-settings
│   ├── routes/
│   │   ├── health.py       /internal/health
│   │   ├── embed.py        /internal/embed
│   │   └── etl.py          /internal/etl/trigger
│   └── etl/
│       ├── scheduler.py    APScheduler
│       └── jobs.py         cron 잡 정의 (W2 에서 실제 ETL)
└── dev_jobs_core/          dev-jobs-mcp 에서 복사한 코어
    ├── sources/            RemoteOK / Arbeitnow / Greenhouse / Lever / Ashby / JSearch
    ├── analyzers/          visa / salary / stack
    ├── recommender/        embeddings / scorer / engine / profile / seniority
    ├── data/companies.json
    ├── intel.py            HN Algolia
    ├── models.py           JobPosting
    └── registry.py         회사 조회
```

## dev_jobs_core 의 동기화 정책

복사본이므로 dev-jobs-mcp 가 진화하면 수동 sync. 향후 PyPI 패키지로 분리 시 정식 dependency 로 전환.
