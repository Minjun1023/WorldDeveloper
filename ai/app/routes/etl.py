"""ETL 수동 트리거 (개발용)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..etl.jobs import run_full_cycle
from ..etl.visa_reclassify import reclassify_unclear_visa

router = APIRouter()


@router.post("/etl/reclassify-visa")
async def reclassify_visa_endpoint(limit: int | None = None) -> dict:
    try:
        return {"status": "ok", "result": await reclassify_unclear_visa(limit)}
    except Exception as e:
        raise HTTPException(500, f"reclassify failed: {e}") from e


@router.post("/etl/trigger")
async def trigger_etl(
    limit_per_source: int = 500,
    include_ats: bool = True,
    ats_limit_per_company: int = 1000,
    reclassify: bool = False,
) -> dict:
    """수동으로 ETL 한 사이클 실행.

    reclassify=false(기본)면 OpenAI 호출 없이 수집·정리(전부 로컬)만 수행한다.
    비자 LLM 재분류가 필요하면 reclassify=true 또는 /etl/reclassify-visa 를 별도 호출.
    """
    try:
        result = await run_full_cycle(
            limit_per_source=limit_per_source,
            include_ats=include_ats,
            ats_limit_per_company=ats_limit_per_company,
            reclassify=reclassify,
        )
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(500, f"ETL failed: {e}") from e
