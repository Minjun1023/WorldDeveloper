"""unclear 공고 재분류: 확장 키워드 → LLM → 회사 추론. 매 ETL 사이클 + 수동 백필."""
from __future__ import annotations

import asyncio
import logging

from dev_jobs_core.analyzers.uk_location import is_uk_location
from dev_jobs_core.analyzers.us_location import is_us_location
from dev_jobs_core.analyzers.visa import classify_visa
from dev_jobs_core.registry import h1b_sponsor_slugs, uk_sponsor_slugs

from ..db import fetch_unclear_jobs, get_conn, sponsor_company_slugs, update_visa
from .visa_llm import classify_visa_llm

log = logging.getLogger(__name__)

_LLM_CONCURRENCY = 8

UK_EVIDENCE = "회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"


def match_uk_register(jobs: list[dict], uk_slugs: set[str]) -> dict[str, tuple[str, list[str]]]:
    """unclear 공고 중 (회사가 UK 스폰서 + UK 소재)인 것을 sponsors 로 매핑.

    순수 함수(DB/네트워크 없음). 입력 jobs 는 fetch_unclear_jobs 형식 dict.
    """
    out: dict[str, tuple[str, list[str]]] = {}
    for j in jobs:
        if j.get("company_slug") in uk_slugs and is_uk_location(
            j.get("location"), j.get("is_remote", False)
        ):
            out[j["id"]] = ("sponsors", [UK_EVIDENCE])
    return out


H1B_EVIDENCE = "회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)"


def match_h1b_register(jobs: list[dict], h1b_slugs: set[str]) -> dict[str, tuple[str, list[str]]]:
    """unclear 공고 중 (회사가 H-1B 스폰서 + 미국 소재)인 것을 sponsors 로 매핑.

    순수 함수(DB/네트워크 없음). 입력 jobs 는 fetch_unclear_jobs 형식 dict.
    """
    out: dict[str, tuple[str, list[str]]] = {}
    for j in jobs:
        if j.get("company_slug") in h1b_slugs and is_us_location(
            j.get("location"), j.get("is_remote", False)
        ):
            out[j["id"]] = ("sponsors", [H1B_EVIDENCE])
    return out


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

        # 1.5) UK 스폰서 레지스터 매칭 (무료·사실 기반, LLM 앞에서 비용 절감)
        uk_slugs = uk_sponsor_slugs()
        uk_hits = match_uk_register(remaining, uk_slugs)
        by_uk_register = len(uk_hits)
        results.update(uk_hits)
        remaining = [j for j in remaining if j["id"] not in uk_hits]

        # 1.6) US H-1B 스폰서 매칭 (무료·사실 기반, UK 직후·LLM 앞)
        h1b_hits = match_h1b_register(remaining, h1b_sponsor_slugs())
        by_h1b_register = len(h1b_hits)
        results.update(h1b_hits)
        remaining = [j for j in remaining if j["id"] not in h1b_hits]

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
            "by_uk_register": by_uk_register,
            "by_h1b_register": by_h1b_register,
            "by_llm": by_llm,
            "by_company": by_company,
            "still_unclear": len(jobs) - len(results),
        }
    finally:
        conn.close()
