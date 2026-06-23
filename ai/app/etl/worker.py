"""독립 ETL 워커.

웹(uvicorn)과 분리된 프로세스에서 스케줄러만 돌린다 — 수집이 도는 동안에도
ai 웹 서비스(embed/coach/추천)가 멈추지 않도록 CPU·블로킹을 격리한다.

실행: python -m app.etl.worker  (docker compose 의 etl-worker 서비스)
"""
from __future__ import annotations

import asyncio
import logging
import signal

from ..config import settings
from .jobs import run_full_cycle
from .scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app.etl.worker")


async def _run() -> None:
    # 부트스트랩: 새 환경이면 첫 자정을 기다리지 않고 즉시 1회 수집(ETL_RUN_ON_START=1).
    if settings.etl_run_on_start:
        log.info("RUN_ON_START: 부팅 시 1회 수집 시작")
        try:
            result = await run_full_cycle()
            log.info("부팅 수집 완료: upserted=%s", result.get("upserted"))
        except Exception:  # noqa: BLE001 — 부팅 수집 실패가 스케줄러 기동을 막지 않도록
            log.exception("부팅 수집 실패 — 스케줄러는 계속 기동한다")

    # 번역 캐시 워밍: 수집 없이 미번역 공고만 번역(부팅 1회). 배포 직후 자정을 안 기다리고 즉시 적용.
    if settings.translate_backfill_on_start:
        log.info("TRANSLATE_BACKFILL_ON_START: 번역 사전캐시 백필 시작")
        try:
            from .backfill_translations import backfill_translations

            stats = await backfill_translations()
            log.info("번역 백필 완료: %s", stats)
        except Exception:  # noqa: BLE001 — 백필 실패가 스케줄러 기동을 막지 않도록
            log.exception("번역 백필 실패 — 스케줄러는 계속 기동한다")

    start_scheduler()  # AsyncIOScheduler 가 현재 이벤트 루프에 붙는다
    log.info("ETL worker up; 스케줄러 대기 중 (cron=%s tz=%s)", settings.etl_cron, settings.etl_timezone)

    # 종료 신호(SIGTERM=compose stop, SIGINT)까지 루프를 살려둔다.
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()

    shutdown_scheduler()
    log.info("ETL worker 종료")


if __name__ == "__main__":
    asyncio.run(_run())
