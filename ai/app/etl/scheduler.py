"""APScheduler 기반 cron 등록 (in-process)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from ..config import settings
from .jobs import run_full_cycle

log = logging.getLogger(__name__)
_scheduler: AsyncIOScheduler | None = None


def build_etl_trigger() -> CronTrigger:
    """매일 고정 시각(cron) 트리거. 기본 ETL_CRON='0 0 * * *' = 매일 자정(ETL_TIMEZONE 기준)."""
    return CronTrigger.from_crontab(settings.etl_cron, timezone=settings.etl_timezone)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    # 인터벌(시작 시각 종속) → cron(매일 고정 시각). next_run_time 미지정 = 다음 cron 시각에 첫 실행.
    _scheduler.add_job(
        run_full_cycle,
        build_etl_trigger(),
        id="etl_full_cycle",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("APScheduler started: etl_full_cycle cron='%s' tz=%s",
             settings.etl_cron, settings.etl_timezone)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("APScheduler stopped")
