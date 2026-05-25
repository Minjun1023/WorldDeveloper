"""ETL 사이클: 외부 소스 수집 → 변환(비자/salary/임베딩) → Postgres upsert.

소스:
  - 잡보드: RemoteOK(원격) + Arbeitnow(유럽)
  - 회사 ATS: Greenhouse / Lever / Ashby — registry(companies.json)에 등록된
    회사들의 공개 채용 보드를 직접 수집. EU 회사(wise/klarna/revolut/n26/qonto
    /pleo/spotify/miro 등) 포함 → 공고 수 + 비자 스폰서 명시 비율 향상.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from dev_jobs_core import registry
from dev_jobs_core.sources import adzuna, arbeitnow, ashby, greenhouse, lever, remoteok, weworkremotely
from dev_jobs_core.dedup import dedup
from dev_jobs_core.filter import is_dev_role

from ..config import settings
from ..db import (
    deactivate_expired,
    deactivate_stale,
    get_conn,
    upsert_company,
    upsert_job,
)
from .transform import transform

log = logging.getLogger(__name__)

# ats 이름 → fetch(company_token, limit) 코루틴
ATS_FETCHERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
}


async def _fetch_ats_company(
    sem: asyncio.Semaphore, ats: str, token: str, limit: int
) -> list:
    """회사 한 곳의 ATS 보드 수집 (동시성 제한)."""
    fn = ATS_FETCHERS.get(ats)
    if fn is None:
        return []
    async with sem:
        return await fn(token, limit=limit)


async def run_full_cycle(
    limit_per_source: int = 100,
    include_ats: bool = True,
    ats_limit_per_company: int = 20,
    ats_concurrency: int = 8,
) -> dict:
    """ETL 한 사이클. 결과 통계 dict 반환."""
    started = datetime.now(timezone.utc)
    postings = []
    fetch_stats: dict[str, object] = {}

    # 1a. 잡보드 (병렬, 소스 실패 격리)
    boards = {"remoteok": remoteok.fetch, "arbeitnow": arbeitnow.fetch, "wwr": weworkremotely.fetch}
    board_results = await asyncio.gather(
        *[fn("", limit=limit_per_source) for fn in boards.values()],
        return_exceptions=True,
    )
    for name, res in zip(boards.keys(), board_results):
        if isinstance(res, Exception):
            fetch_stats[name] = f"error: {type(res).__name__}: {res}"
            log.warning("source %s 실패: %s", name, res)
        else:
            postings.extend(res)
            fetch_stats[name] = len(res)

    # 1b. 회사 ATS (registry 등록 회사, 회사별 실패 격리 + 동시성 제한)
    if include_ats:
        companies = [c for c in registry.list_all() if c.get("ats") in ATS_FETCHERS]
        sem = asyncio.Semaphore(ats_concurrency)
        ats_results = await asyncio.gather(
            *[
                _fetch_ats_company(sem, c["ats"], c["token"], ats_limit_per_company)
                for c in companies
            ],
            return_exceptions=True,
        )
        ats_ok = 0
        ats_failed = 0
        ats_jobs = 0
        for c, res in zip(companies, ats_results):
            if isinstance(res, Exception):
                ats_failed += 1
                log.warning("ATS %s/%s 실패: %s", c["ats"], c["token"], res)
            else:
                postings.extend(res)
                ats_ok += 1
                ats_jobs += len(res)
        fetch_stats["ats_companies_ok"] = ats_ok
        fetch_stats["ats_companies_failed"] = ats_failed
        fetch_stats["ats_jobs"] = ats_jobs

    # 1c. Adzuna (다국가, 키 있을 때만, 실패 격리)
    if adzuna.is_enabled():
        try:
            adz = await adzuna.fetch(
                countries=settings.adzuna_countries_list,
                per_country=settings.adzuna_per_country,
                max_pages=settings.adzuna_max_pages,
            )
            postings.extend(adz)
            fetch_stats["adzuna"] = len(adz)
        except Exception as e:  # noqa: BLE001
            fetch_stats["adzuna"] = f"error: {type(e).__name__}"
            log.warning("adzuna 실패: %s", e)
    else:
        fetch_stats["adzuna"] = "disabled (no key)"

    # 1d. 개발 직무 필터
    before_filter = len(postings)
    postings = [p for p in postings if is_dev_role(p.title, p.tags, p.description)]
    fetch_stats["filtered_out"] = before_filter - len(postings)

    # 2. dedup (job_id 완전일치 + 크로스소스 정규화 키 + 소스 우선순위)
    unique_list = dedup(postings)
    fetch_stats["deduped_from"] = len(postings)
    fetch_stats["deduped_to"] = len(unique_list)

    # 3. transform + 4. upsert
    upserted = 0
    failed = 0
    conn = get_conn()
    try:
        for p in unique_list:
            try:
                company_row, job_row = transform(p)
                upsert_company(conn, company_row)
                upsert_job(conn, job_row)
                upserted += 1
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                failed += 1
                log.warning("upsert 실패 %s: %s", p.job_id, e)
        deactivated_stale = deactivate_stale(conn, days=settings.stale_days)
        deactivated_expired = deactivate_expired(conn, max_age_days=settings.job_max_age_days)
        conn.commit()
    finally:
        conn.close()

    result = {
        "started_at": started.isoformat(),
        "fetched": fetch_stats,
        "unique": len(unique_list),
        "upserted": upserted,
        "failed": failed,
        "deactivated_stale": deactivated_stale,
        "deactivated_expired": deactivated_expired,
        "duration_sec": round((datetime.now(timezone.utc) - started).total_seconds(), 1),
    }
    log.info("ETL cycle 완료: %s", result)
    return result
