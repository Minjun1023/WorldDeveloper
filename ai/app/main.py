"""FastAPI 엔트리포인트.

엔드포인트:
  GET  /internal/health        liveness
  POST /internal/embed         text -> vector(384)
  POST /internal/translate     공고 제목/본문 기계 번역 (DeepL)
  POST /internal/etl/trigger   수동 ETL 트리거 (dev 전용)

ETL 은 lifespan 안에서 APScheduler 로 등록 (settings.etl_enabled=True 일 때만).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .etl.scheduler import shutdown_scheduler, start_scheduler
from .routes import embed, etl, health, parse_profile, summarize, translate

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.etl_enabled:
        log.info("Starting ETL scheduler (interval=%d min)", settings.etl_interval_minutes)
        start_scheduler()
    else:
        log.info("ETL disabled (set ETL_ENABLED=1 to enable)")
    yield
    shutdown_scheduler()


app = FastAPI(
    title="dev-jobs-ai",
    version="0.1.0",
    description="임베딩 inference + ETL worker. Spring 백엔드 내부 호출 전용.",
    lifespan=lifespan,
)

app.include_router(health.router, prefix="/internal", tags=["internal"])
app.include_router(embed.router, prefix="/internal", tags=["internal"])
app.include_router(translate.router, prefix="/internal", tags=["internal"])
app.include_router(summarize.router, prefix="/internal", tags=["internal"])
app.include_router(etl.router, prefix="/internal", tags=["internal"])
app.include_router(parse_profile.router, prefix="/internal", tags=["internal"])
