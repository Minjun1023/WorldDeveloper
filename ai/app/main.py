"""FastAPI 엔트리포인트.

엔드포인트:
  GET  /internal/health        liveness
  POST /internal/embed         text -> vector(384)
  POST /internal/skill-match   JD/이력서 -> 보유/미보유 스킬(코치 키워드 갭)
  POST /internal/etl/trigger   수동 ETL 트리거 (dev 전용)

ETL 은 lifespan 안에서 APScheduler 로 등록 (settings.etl_enabled=True 일 때만).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from .config import settings
from .etl.scheduler import shutdown_scheduler, start_scheduler
from .routes import coach, embed, etl, health, parse_profile, skill_match, summarize

log = logging.getLogger(__name__)


def verify_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    """settings.internal_auth_token 이 설정된 경우에만 X-Internal-Token 헤더를 강제한다.

    기본값(빈 문자열)이면 비활성 — 로컬/테스트는 네트워크 격리에 의존하고, 운영에서
    INTERNAL_AUTH_TOKEN env 를 켜면 비인증 호출(유료 OpenAI 트리거/DoS)을 차단한다.
    """
    expected = settings.internal_auth_token
    if expected and x_internal_token != expected:
        raise HTTPException(status_code=401, detail="invalid or missing internal token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 임베딩 모델 워밍업 — 콜드스타트 시 첫 추론이 느려, 매칭 점수(/score)·추천의 첫 요청이
    # web 15s 타임아웃을 넘겨 점수가 안 뜨고(2~3회 새로고침 필요) 추천 semantic 이 0 으로 떨어졌다.
    # 기동 시 더미 1회 추론으로 모델을 미리 로드해 첫 요청부터 정상 동작하게 한다.
    try:
        from dev_jobs_core.recommender import embeddings as core_emb
        if core_emb.is_available():
            core_emb._embed_cached("warmup")
            log.info("embedding model warmed up")
    except Exception:  # noqa: BLE001 — 워밍업 실패가 기동을 막지 않도록
        log.warning("embedding warmup skipped", exc_info=True)

    if settings.etl_enabled:
        log.info("Starting ETL scheduler (cron='%s' tz=%s)", settings.etl_cron, settings.etl_timezone)
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

# health 는 liveness 프로브용으로 인증 없이 개방. 나머지(작업/유료 경로)는 토큰 강제(설정 시).
_auth = [Depends(verify_internal_token)]
app.include_router(health.router, prefix="/internal", tags=["internal"])
app.include_router(embed.router, prefix="/internal", tags=["internal"], dependencies=_auth)
app.include_router(summarize.router, prefix="/internal", tags=["internal"], dependencies=_auth)
app.include_router(coach.router, prefix="/internal", tags=["internal"], dependencies=_auth)
app.include_router(etl.router, prefix="/internal", tags=["internal"], dependencies=_auth)
app.include_router(parse_profile.router, prefix="/internal", tags=["internal"], dependencies=_auth)
app.include_router(skill_match.router, prefix="/internal", tags=["internal"], dependencies=_auth)
