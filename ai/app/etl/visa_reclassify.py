"""unclear 공고 재분류: 확장 키워드 → LLM → 회사 추론. 매 ETL 사이클 + 수동 백필."""
from __future__ import annotations

import asyncio
import logging

from dev_jobs_core.analyzers.visa import classify_visa

from ..db import fetch_unclear_jobs, get_conn, sponsor_company_slugs, update_visa
from .visa_llm import classify_visa_llm

log = logging.getLogger(__name__)

_LLM_CONCURRENCY = 8


async def reclassify_unclear_visa(limit: int | None = None) -> dict:
    conn = get_conn()
    try:
        jobs = fetch_unclear_jobs(conn, limit)
        sponsor_companies = sponsor_company_slugs(conn)

        results: dict[str, tuple[str, list[str]]] = {}
        by_keyword = 0
        # 1) 확장 키워드 (sync)
        remaining = []
        for j in jobs:
            status, ev = classify_visa(j["description_text"] or "")
            if status != "unclear":
                results[j["id"]] = (status, ev)
                by_keyword += 1
            else:
                remaining.append(j)

        # 2) LLM (동시성 제한 + 설명 캐시)
        cache: dict[str, tuple[str, list[str]] | None] = {}
        sem = asyncio.Semaphore(_LLM_CONCURRENCY)

        async def run(j):
            desc = j["description_text"] or ""
            if desc not in cache:
                async with sem:
                    cache[desc] = await classify_visa_llm(j["title"], desc)
            return j["id"], cache[desc]

        by_llm = 0
        if remaining:
            for jid, out in await asyncio.gather(*[run(j) for j in remaining]):
                if out and out[0] != "unclear":
                    results[jid] = out
                    by_llm += 1

        # 3) 회사 추론 (여전히 unclear + 회사에 명시 sponsor 공고)
        by_company = 0
        for j in jobs:
            if j["id"] not in results and j["company_slug"] in sponsor_companies:
                results[j["id"]] = ("sponsors", ["같은 회사의 다른 공고에 비자 스폰서 명시"])
                by_company += 1

        # 4) UPDATE
        for jid, (status, ev) in results.items():
            update_visa(conn, jid, status, ev)
        conn.commit()

        return {
            "unclear_in": len(jobs),
            "updated": len(results),
            "by_keyword": by_keyword,
            "by_llm": by_llm,
            "by_company": by_company,
            "still_unclear": len(jobs) - len(results),
        }
    finally:
        conn.close()
