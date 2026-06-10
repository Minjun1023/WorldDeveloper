"""ETL 사이클: 외부 소스 수집 → 변환(비자/salary/임베딩) → Postgres upsert.

소스:
  - 잡보드: RemoteOK(원격) + Arbeitnow(유럽)
  - 회사 ATS: Greenhouse / Lever / Ashby / SmartRecruiters / Personio —
    registry(companies.json)에 등록된 회사들의 공개 채용 보드를 직접 수집.
    EU 회사(wise/klarna/revolut/n26/qonto/pleo/adyen/mollie/celonis 등) 포함
    → 공고 수 + 비자 스폰서 명시 비율 향상.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from dev_jobs_core import registry
from dev_jobs_core.dedup import dedup
from dev_jobs_core.filter import is_dev_role
from dev_jobs_core.sources import (
    adzuna,
    arbeitnow,
    ashby,
    greenhouse,
    lever,
    personio,
    remoteok,
    smartrecruiters,
    weworkremotely,
    workable,
)

from ..config import settings
from ..db import (
    active_id_titles,
    deactivate_expired,
    deactivate_jobs,
    deactivate_stale,
    deactivate_unseen_in_scopes,
    get_conn,
    upsert_company,
    upsert_job,
)
from .transform import transform
from .viability import is_dead_end
from .visa_reclassify import reclassify_unclear_visa

log = logging.getLogger(__name__)

# ats 이름 → fetch(company_token, limit) 코루틴
ATS_FETCHERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "smartrecruiters": smartrecruiters.fetch,
    "personio": personio.fetch,
    "workable": workable.fetch,
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
    limit_per_source: int = 500,
    include_ats: bool = True,
    ats_limit_per_company: int = 1000,
    ats_concurrency: int = 8,
    reclassify: bool | None = None,
) -> dict:
    """ETL 한 사이클. 결과 통계 dict 반환.

    reclassify: 비자 LLM 재분류(OpenAI 호출) 수행 여부. None 이면 settings.etl_reclassify 를 따른다.
    수집·정리(전부 로컬)와 유료 LLM 단계를 분리하기 위한 스위치 — 기본은 off(무비용).
    """
    started = datetime.now(UTC)
    postings = []
    fetch_stats: dict[str, object] = {}
    # 성공+완전(limit 미만=잘림 없음) 수집된 범위만 즉시 정리 대상. 실패/잘린 범위는 제외(깜빡임 방지).
    complete_boards: list[str] = []   # 잡보드 source
    complete_ats: list[str] = []      # "{ats}:{token}" (= job id 접두 = source:company_slug)

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
            if len(res) < limit_per_source:  # limit 에 안 걸림 = 전량 수집
                complete_boards.append(name)

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
                if len(res) < ats_limit_per_company:  # limit 에 안 걸림 = 전량 수집
                    complete_ats.append(f'{c["ats"]}:{c["token"]}')
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
    dropped_dead_end = 0
    conn = get_conn()
    try:
        # 업서트 직전 DB 시각 = "이번 사이클" 경계. 이후 재관측 공고는 last_seen_at > threshold,
        # 미관측 공고는 last_seen_at < threshold (앱/DB 시계차 영향 없도록 DB now() 사용).
        threshold = conn.execute("SELECT now()").fetchone()[0]
        for p in unique_list:
            try:
                company_row, job_row = transform(p)
                if is_dead_end(
                    job_row["visa_status"], job_row["is_remote"], job_row["remote_eligibility"]
                ):
                    dropped_dead_end += 1
                    continue
                upsert_company(conn, company_row)
                upsert_job(conn, job_row)
                upserted += 1
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                failed += 1
                log.warning("upsert 실패 %s: %s", p.job_id, e)
        deactivated_stale = deactivate_stale(conn, days=settings.stale_days)
        deactivated_expired = deactivate_expired(conn, max_age_days=settings.job_max_age_days)
        # 4b. 저장 공고 재필터(self-heal): 강화된 deny-list 로 과거 적재 비개발 직무 비활성화.
        #     필터는 ingest 때만 돌아 stored row 는 옛 규칙대로 남으므로 매 사이클 재평가.
        nondev_ids = [jid for jid, title in active_id_titles(conn) if not is_dev_role(title)]
        deactivated_nondev = deactivate_jobs(conn, nondev_ids)
        # 4c. 성공+완전 수집 범위에서 이번에 사라진 공고 즉시 정리(7일 유예 생략, 깜빡임 없음).
        deactivated_unseen = (
            deactivate_unseen_in_scopes(conn, complete_ats, complete_boards, threshold)
            if settings.etl_prune_unseen else 0
        )
        conn.commit()
    finally:
        conn.close()

    result = {
        "started_at": started.isoformat(),
        "fetched": fetch_stats,
        "unique": len(unique_list),
        "upserted": upserted,
        "dropped_dead_end": dropped_dead_end,
        "failed": failed,
        "deactivated_stale": deactivated_stale,
        "deactivated_expired": deactivated_expired,
        "deactivated_nondev": deactivated_nondev,
        "deactivated_unseen": deactivated_unseen,
        "scopes_complete": {"ats": len(complete_ats), "boards": len(complete_boards)},
        "duration_sec": round((datetime.now(UTC) - started).total_seconds(), 1),
    }

    # 5. unclear 비자 재분류. 무료 단계(키워드+정부명부+회사추론)는 항상 실행해 재import 로
    #    키워드만으로 리셋된 분류를 복구한다. OpenAI LLM 단계만 옵트인(etl_reclassify/reclassify).
    use_llm = settings.etl_reclassify if reclassify is None else reclassify
    try:
        result["visa_reclassified"] = await reclassify_unclear_visa(use_llm=use_llm)
    except Exception as e:  # noqa: BLE001
        log.warning("visa 재분류 실패: %s", e)
        result["visa_reclassified"] = {"error": str(e)}

    log.info("ETL cycle 완료: %s", result)
    return result
