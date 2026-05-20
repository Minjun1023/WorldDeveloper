"""APScheduler 기반 cron 등록 (in-process)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..config import settings
from .jobs import run_full_cycle_stub

log = logging.getLogger(__name__)
_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_full_cycle_stub,
        "interval",
        minutes=settings.etl_interval_minutes,
        next_run_time=None,  # 첫 실행은 interval 후
        id="etl_full_cycle",
        replace_existing=True,
    )
    _scheduler.start()
    log.info("APScheduler started: etl_full_cycle every %dm", settings.etl_interval_minutes)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("APScheduler stopped")
