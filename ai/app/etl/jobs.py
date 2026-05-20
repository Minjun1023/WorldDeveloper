"""ETL 사이클: 외부 소스 수집 → 변환(비자/salary/임베딩) → Postgres upsert.

소스: RemoteOK(원격) + Arbeitnow(유럽). 회사 ATS(Greenhouse/Lever/Ashby) 직접 수집은
EU 회사 우선으로 후속 확장.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from dev_jobs_core.sources import arbeitnow, remoteok

from ..db import deactivate_stale, get_conn, upsert_company, upsert_job
from .transform import transform

log = logging.getLogger(__name__)


async def run_full_cycle(limit_per_source: int = 100) -> dict:
    """ETL 한 사이클. 결과 통계 dict 반환."""
    started = datetime.now(timezone.utc)

    # 1. fetch (병렬, 소스 실패 격리)
    sources = {"remoteok": remoteok.fetch, "arbeitnow": arbeitnow.fetch}
    results = await asyncio.gather(
        *[fn("", limit=limit_per_source) for fn in sources.values()],
        return_exceptions=True,
    )
    postings = []
    fetch_stats: dict[str, object] = {}
    for name, res in zip(sources.keys(), results):
        if isinstance(res, Exception):
            fetch_stats[name] = f"error: {type(res).__name__}: {res}"
            log.warning("source %s 실패: %s", name, res)
        else:
            postings.extend(res)
            fetch_stats[name] = len(res)

    # 2. dedup (job_id)
    unique = {p.job_id: p for p in postings}

    # 3. transform + 4. upsert
    upserted = 0
    failed = 0
    conn = get_conn()
    try:
        for p in unique.values():
            try:
                company_row, job_row = transform(p)
                upsert_company(conn, company_row)
                upsert_job(conn, job_row)
                upserted += 1
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                failed += 1
                log.warning("upsert 실패 %s: %s", p.job_id, e)
        deactivated = deactivate_stale(conn, days=7)
        conn.commit()
    finally:
        conn.close()

    result = {
        "started_at": started.isoformat(),
        "fetched": fetch_stats,
        "unique": len(unique),
        "upserted": upserted,
        "failed": failed,
        "deactivated": deactivated,
        "duration_sec": round((datetime.now(timezone.utc) - started).total_seconds(), 1),
    }
    log.info("ETL cycle 완료: %s", result)
    return result
