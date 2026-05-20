"""ETL 수동 트리거 (개발용)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..etl.jobs import run_full_cycle

router = APIRouter()


@router.post("/etl/trigger")
async def trigger_etl(limit_per_source: int = 100) -> dict:
    """수동으로 ETL 한 사이클 실행."""
    try:
        result = await run_full_cycle(limit_per_source=limit_per_source)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(500, f"ETL failed: {e}") from e
